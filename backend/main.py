from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import pdfplumber
import json
from typing import List, Dict, Any, Optional
import pandas as pd
import tempfile
import os
from pydantic import BaseModel, EmailStr
import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import uuid

app = FastAPI(title="PDF Text Extraction API", version="1.0.0")

# Security configuration
SECRET_KEY = "your-secret-key-here"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()

# In-memory user storage (replace with database in production)
users_db = {}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js development server on port 3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class TextBlock(BaseModel):
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    width: float
    height: float
    page: int

class ExportData(BaseModel):
    data: List[List[str]]
    filename: str
    format: str

# Authentication helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(user_id: str = Depends(verify_token)):
    user = users_db.get(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# Authentication endpoints
@app.post("/auth/signup", response_model=Token)
async def signup(user_data: UserCreate):
    # Check if user already exists
    for user in users_db.values():
        if user["email"] == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    new_user = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    users_db[user_id] = new_user
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    # Return token and user info
    user_response = User(
        id=user_id,
        name=new_user["name"],
        email=new_user["email"],
        created_at=new_user["created_at"]
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    # Find user by email
    user = None
    user_id = None
    for uid, u in users_db.items():
        if u["email"] == user_credentials.email:
            user = u
            user_id = uid
            break
    
    if not user or not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    # Return token and user info
    user_response = User(
        id=user_id,
        name=user["name"],
        email=user["email"],
        created_at=user["created_at"]
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return User(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        created_at=current_user["created_at"]
    )

@app.get("/")
async def root():
    return {"message": "PDF Text Extraction API"}

# Protected PDF processing endpoints
@app.post("/upload-pdf/", response_model=List[TextBlock])
async def upload_pdf(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """
    Upload a PDF file and extract text blocks with coordinates
    """
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        print(f"Processing PDF file: {file.filename}, size: {file.size} bytes for user: {current_user['email']}")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        print(f"Temporary file created: {tmp_file_path}")
        
        # Extract text blocks using pdfplumber
        text_blocks = []
        
        with pdfplumber.open(tmp_file_path) as pdf:
            print(f"PDF opened successfully, {len(pdf.pages)} pages found")
            
            for page_num, page in enumerate(pdf.pages):
                # Extract text with bounding boxes
                chars = page.chars
                
                # Group characters into words and lines
                words = page.extract_words()
                print(f"Page {page_num + 1}: extracted {len(words)} words")
                
                # Convert words to TextBlock objects first
                raw_blocks = []
                for word in words:
                    # Check if word has all required keys - pdfplumber uses 'top'/'bottom' instead of 'y0'/'y1'
                    required_keys = ['text', 'x0', 'x1']
                    y_keys = ['y0', 'y1'] if 'y0' in word else ['top', 'bottom']
                    
                    missing_keys = [key for key in required_keys + y_keys if key not in word]
                    if missing_keys:
                        print(f"Warning: Word missing keys {missing_keys}: {word}")
                        continue
                    
                    # Map the coordinate keys properly
                    y0 = word.get('y0', word.get('top'))
                    y1 = word.get('y1', word.get('bottom'))
                    
                    text_block = TextBlock(
                        text=word['text'],
                        x0=word['x0'],
                        y0=y0,
                        x1=word['x1'],
                        y1=y1,
                        width=word['x1'] - word['x0'],
                        height=abs(y1 - y0),  # Use abs() in case top/bottom are inverted
                        page=page_num + 1
                    )
                    raw_blocks.append(text_block)
                
                # Now group the raw blocks into logical units (better multi-line grouping)
                grouped_blocks = group_text_blocks(raw_blocks)
                text_blocks.extend(grouped_blocks)
        
        # Clean up temp file
        os.unlink(tmp_file_path)
        
        print(f"Successfully processed PDF: {len(text_blocks)} text blocks extracted")
        return text_blocks
        
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        # Clean up temp file if it exists
        if 'tmp_file_path' in locals():
            try:
                os.unlink(tmp_file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

def group_text_blocks(blocks: List[TextBlock]) -> List[TextBlock]:
    """
    Conservative text grouping algorithm - only groups very close text blocks
    to handle cases like "Rupees Twelve Thousand Nine Hundred and Paise Zero Only"
    """
    if not blocks:
        return blocks
    
    grouped = []
    used = set()
    
    for i, block in enumerate(blocks):
        if i in used:
            continue
            
        # Start a new group with this block
        current_group = [block]
        used.add(i)
        
        # Find nearby blocks (limited to prevent over-grouping)
        def find_nearby_blocks(target_block):
            for j, other_block in enumerate(blocks):
                if j in used or len(current_group) >= 6:  # Limit group size
                    continue
                
                # Check if blocks should be grouped together (conservative)
                if should_group_blocks(target_block, other_block):
                    current_group.append(other_block)
                    used.add(j)
                    # Only one level of recursion to prevent chaining
                    if len(current_group) < 4:
                        find_nearby_blocks(other_block)
        
        # Find nearby blocks with limited recursion
        find_nearby_blocks(block)
        
        if len(current_group) > 1:
            # Sort blocks for proper reading order (left-to-right)
            current_group.sort(key=lambda b: b.x0)
            
            # Create combined block
            combined_text = ' '.join(b.text.strip() for b in current_group)
            combined_block = TextBlock(
                text=combined_text,
                x0=min(b.x0 for b in current_group),
                y0=min(b.y0 for b in current_group), 
                x1=max(b.x1 for b in current_group),
                y1=max(b.y1 for b in current_group),
                width=max(b.x1 for b in current_group) - min(b.x0 for b in current_group),
                height=max(b.y1 for b in current_group) - min(b.y0 for b in current_group),
                page=block.page
            )
            
            print(f"📦 Grouped {len(current_group)} blocks: {combined_text[:50]}...")
            grouped.append(combined_block)
        else:
            grouped.append(block)
    
    return grouped

def should_group_blocks(block1: TextBlock, block2: TextBlock) -> bool:
    """
    Conservative approach - only group text blocks that are very close and clearly part of the same text element
    """
    # Calculate dimensions
    avg_height = (block1.height + block2.height) / 2
    avg_width = (block1.width + block2.width) / 2
    
    # Vertical alignment check (for horizontal grouping - same line)
    vertical_overlap = min(block1.y1, block2.y1) - max(block1.y0, block2.y0)
    horizontal_gap = min(abs(block1.x1 - block2.x0), abs(block2.x1 - block1.x0))
    
    # Conservative thresholds - only group very close words
    max_horizontal_gap = avg_width * 0.5  # Much more conservative
    min_vertical_overlap = avg_height * 0.6  # Require good vertical alignment
    
    # Check for horizontal grouping (words on same line)
    is_same_line = vertical_overlap >= min_vertical_overlap and horizontal_gap <= max_horizontal_gap
    
    # Additional safety check: ensure combined block isn't too big
    combined_width = abs(max(block1.x1, block2.x1) - min(block1.x0, block2.x0))
    combined_height = abs(max(block1.y1, block2.y1) - min(block1.y0, block2.y0))
    
    max_reasonable_width = avg_width * 5  # Max width for a text phrase
    max_reasonable_height = avg_height * 1.5  # Max 1.5 line heights
    
    is_reasonable_size = combined_width <= max_reasonable_width and combined_height <= max_reasonable_height
    
    # Only group if on same line AND reasonable size
    should_group = is_same_line and is_reasonable_size
    
    if should_group:
        print(f"📝 Grouping: '{block1.text}' + '{block2.text}' (conservative)")
    
    return should_group

@app.post("/export-data/")
async def export_data(export_data: ExportData, current_user: dict = Depends(get_current_user)):
    """
    Export table data to Excel or CSV format
    """
    try:
        print(f"Exporting data for user: {current_user['email']}")
        
        # Create DataFrame from the data
        df = pd.DataFrame(export_data.data)
        
        # Create temporary file for export
        if export_data.format.lower() == 'xlsx':
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
                df.to_excel(tmp_file.name, index=False, header=False)
                tmp_file_path = tmp_file.name
            
            filename = f"{export_data.filename}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
        elif export_data.format.lower() == 'csv':
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv', mode='w') as tmp_file:
                df.to_csv(tmp_file.name, index=False, header=False)
                tmp_file_path = tmp_file.name
            
            filename = f"{export_data.filename}.csv"
            media_type = "text/csv"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'xlsx' or 'csv'")
        
        print(f"Export file created: {tmp_file_path}")
        
        # Return file response
        return FileResponse(
            path=tmp_file_path,
            media_type=media_type,
            filename=filename,
            background=None  # File will be cleaned up automatically
        )
        
    except Exception as e:
        print(f"Error exporting data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 