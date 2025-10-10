# 🚀 Simple Deployment Guide for Non-Technical Users

**Goal**: Run your Pandiver application on any computer or cloud server, exactly like it runs on your current laptop.

## What is Docker? (In Simple Terms)

Think of Docker like a **magic box** that contains your entire application:
- All the code
- All the settings
- All the requirements
- Everything needed to run your app

When you copy this "magic box" to another computer, it runs **exactly the same way** - no matter if it's Windows, Mac, Linux, or a cloud server.

---

## 📝 What You Need Before Starting

### Required Files from Your Current Setup
From your current working laptop, you need to copy these files:
1. **Your entire project folder** (`pandiver-new`)
2. **Your `.env` file** (contains your Azure keys - very important!)

### Target System Requirements
The new laptop/server needs:
- **Internet connection** (to download Docker)
- **At least 8GB RAM** (4GB minimum)
- **At least 20GB free space**
- **Any operating system** (Windows, Mac, or Linux)

---

## 🖥️ Step 1: Choose Your Target System

### Option A: Another Laptop/Desktop
- Windows 10/11, macOS, or Linux
- Follow the laptop setup instructions below

### Option B: Cloud Server
- **Amazon AWS**: EC2 instance
- **Google Cloud**: Compute Engine VM
- **Microsoft Azure**: Virtual Machine
- Follow the cloud setup instructions below

---

## 💻 Option A: Setup on Another Laptop/Desktop

### For Windows Users

#### Step 1: Install Docker Desktop
1. Go to https://www.docker.com/products/docker-desktop
2. Click **"Download for Windows"**
3. Run the downloaded file (`Docker Desktop Installer.exe`)
4. Follow the installation wizard (keep all default settings)
5. **Restart your computer** when prompted
6. After restart, Docker Desktop should start automatically
7. You'll see a Docker whale icon in your system tray

#### Step 2: Install Git (if not already installed)
1. Go to https://git-scm.com/download/win
2. Download and install Git
3. Keep all default settings during installation

#### Step 3: Copy Your Project
```cmd
# Open Command Prompt (cmd) or PowerShell
# Navigate to where you want to copy the project
cd C:\Users\YourName\Documents

# Copy your project folder here
# You can copy-paste the entire "pandiver-new" folder from your working laptop
```

#### Step 4: Setup and Run
```cmd
# Navigate to your project folder
cd pandiver-new

# Copy your .env file here (from your working laptop)
# Make sure the .env file is in the pandiver-new folder

# Start the application
docker-start.sh
```

### For Mac Users

#### Step 1: Install Docker Desktop
1. Go to https://www.docker.com/products/docker-desktop
2. Click **"Download for Mac"**
3. Choose the right version:
   - **Intel chip**: Download Intel version
   - **Apple chip (M1/M2)**: Download Apple Chip version
4. Open the downloaded `.dmg` file
5. Drag Docker to Applications folder
6. Open Docker from Applications
7. Follow the setup wizard
8. Docker is ready when you see the whale icon in your menu bar

#### Step 2: Install Git (if not already installed)
```bash
# Open Terminal and run:
xcode-select --install
# Or download from: https://git-scm.com/download/mac
```

#### Step 3: Copy Your Project
```bash
# Open Terminal
# Navigate to where you want to copy the project
cd ~/Documents

# Copy your project folder here
# You can copy-paste the entire "pandiver-new" folder from your working laptop
```

#### Step 4: Setup and Run
```bash
# Navigate to your project folder
cd pandiver-new

# Copy your .env file here (from your working laptop)
# Make sure the .env file is in the pandiver-new folder

# Make scripts executable
chmod +x docker-start.sh docker-stop.sh

# Start the application
./docker-start.sh
```

### For Linux Users (Ubuntu/Debian)

#### Step 1: Install Docker
```bash
# Open Terminal and run these commands one by one:
sudo apt update
sudo apt install docker.io docker-compose git -y
sudo usermod -aG docker $USER
newgrp docker
```

#### Step 2: Copy Your Project
```bash
# Navigate to where you want to copy the project
cd ~/Documents

# Copy your project folder here
# You can copy-paste the entire "pandiver-new" folder from your working laptop
```

#### Step 3: Setup and Run
```bash
# Navigate to your project folder
cd pandiver-new

# Copy your .env file here (from your working laptop)
# Make sure the .env file is in the pandiver-new folder

# Make scripts executable
chmod +x docker-start.sh docker-stop.sh

# Start the application
./docker-start.sh
```

---

## ☁️ Option B: Setup on Cloud Server

### Amazon AWS (Easiest Cloud Option)

#### Step 1: Create AWS Account
1. Go to https://aws.amazon.com/
2. Click **"Create an AWS Account"**
3. Follow the signup process (you'll need a credit card)

#### Step 2: Launch a Server
1. Login to AWS Console
2. Go to **EC2** service
3. Click **"Launch Instance"**
4. Choose **"Ubuntu Server 22.04 LTS"**
5. Choose instance type: **"t3.large"** (good performance)
6. Create a new key pair (download the `.pem` file - keep it safe!)
7. In Security Groups, add these rules:
   - **Type**: Custom TCP, **Port**: 3000, **Source**: 0.0.0.0/0
   - **Type**: Custom TCP, **Port**: 8000, **Source**: 0.0.0.0/0
   - **Type**: SSH, **Port**: 22, **Source**: 0.0.0.0/0
8. Click **"Launch Instance"**
9. Wait for the instance to start (Status: Running)

#### Step 3: Connect to Your Server
**Using Windows:**
1. Download PuTTY from https://www.putty.org/
2. Convert your `.pem` key using PuTTYgen
3. Connect using PuTTY with your server's IP address

**Using Mac/Linux:**
```bash
# In Terminal, navigate to where you saved the .pem file
chmod 400 your-key-file.pem
ssh -i your-key-file.pem ubuntu@YOUR-SERVER-IP-ADDRESS
```

#### Step 4: Setup Docker on Server
```bash
# Once connected to your server, run these commands:
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose git -y
sudo usermod -aG docker ubuntu
newgrp docker
```

#### Step 5: Upload Your Project
**Option 1: Using Git (if your code is on GitHub)**
```bash
git clone https://github.com/yourusername/pandiver-new.git
cd pandiver-new
```

**Option 2: Upload manually**
```bash
# On your local computer, compress your project folder
# Upload using scp (Mac/Linux) or WinSCP (Windows)
scp -i your-key-file.pem -r pandiver-new ubuntu@YOUR-SERVER-IP:/home/ubuntu/
```

#### Step 6: Setup Environment and Run
```bash
# On the server:
cd pandiver-new

# Copy your .env file content
nano .env
# Paste your .env file content here, save with Ctrl+X, Y, Enter

# Make scripts executable
chmod +x docker-start.sh docker-stop.sh

# Start the application
./docker-start.sh
```

#### Step 7: Access Your Application
- Open browser and go to: `http://YOUR-SERVER-IP:3000`
- Replace `YOUR-SERVER-IP` with your actual server IP address

### Google Cloud Platform

#### Step 1: Create GCP Account
1. Go to https://cloud.google.com/
2. Click **"Get started for free"**
3. Follow the signup process

#### Step 2: Create a Virtual Machine
1. Go to **Compute Engine** > **VM instances**
2. Click **"Create Instance"**
3. Settings:
   - **Name**: pandiver-server
   - **Region**: Choose closest to you
   - **Machine type**: e2-standard-4 (4 vCPU, 16GB RAM)
   - **Boot disk**: Ubuntu 22.04 LTS
   - **Firewall**: Allow HTTP and HTTPS traffic
4. Click **"Create"**

#### Step 3: Configure Firewall
1. Go to **VPC network** > **Firewall**
2. Click **"Create Firewall Rule"**
3. Settings:
   - **Name**: pandiver-ports
   - **Direction**: Ingress
   - **Action**: Allow
   - **Targets**: All instances in the network
   - **Source IP ranges**: 0.0.0.0/0
   - **Protocols and ports**: TCP, 3000, 8000
4. Click **"Create"**

#### Step 4: Connect and Setup
1. In VM instances, click **"SSH"** next to your instance
2. A browser terminal will open
3. Follow the same setup commands as AWS above

### Microsoft Azure

#### Step 1: Create Azure Account
1. Go to https://azure.microsoft.com/
2. Click **"Start free"**
3. Follow the signup process

#### Step 2: Create Virtual Machine
1. Go to **Virtual machines**
2. Click **"Create"** > **"Azure virtual machine"**
3. Settings:
   - **Subscription**: Your subscription
   - **Resource group**: Create new
   - **Virtual machine name**: pandiver-server
   - **Region**: Choose closest to you
   - **Image**: Ubuntu Server 22.04 LTS
   - **Size**: Standard_D4s_v3 (4 vcpus, 16 GiB memory)
   - **Authentication type**: SSH public key
   - **Username**: azureuser
4. **Networking**: Allow selected ports: SSH (22), HTTP (80), HTTPS (443)
5. Click **"Review + create"** then **"Create"**

#### Step 3: Add Custom Ports
1. Go to your VM > **Networking**
2. Click **"Add inbound port rule"**
3. Add rules for ports 3000 and 8000:
   - **Destination port ranges**: 3000
   - **Protocol**: TCP
   - **Action**: Allow
   - **Priority**: 1000
   - **Name**: Port_3000
4. Repeat for port 8000

#### Step 4: Connect and Setup
1. In your VM overview, click **"Connect"** > **"SSH"**
2. Follow the SSH instructions provided
3. Once connected, follow the same setup commands as AWS above

---

## 🧪 Testing Your Deployment

After running `./docker-start.sh`, wait 2-3 minutes for everything to start, then:

### Step 1: Check if Services are Running
```bash
# Run this command to see if containers are running:
docker-compose -f docker-compose.dev.yml ps

# You should see something like:
# pandiver-new-backend-1    running
# pandiver-new-frontend-1   running
```

### Step 2: Test the Application
1. **Open your web browser**
2. **Go to**: `http://localhost:3000` (for local) or `http://YOUR-SERVER-IP:3000` (for cloud)
3. **You should see the login page**

### Step 3: Login and Test Features
1. **Login with**:
   - Email: `ameetmund@gmail.com`
   - Password: `temp123`
2. **Test these features**:
   - Dashboard loads ✅
   - API sections show API keys ✅
   - PDF Page Splitter works ✅
   - PDF Translator works ✅
   - No "Invalid Token" errors ✅

---

## 🚨 If Something Goes Wrong

### Problem: "Docker not found" or "Command not found"
**Solution**: Docker is not installed properly
```bash
# For Linux users:
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER
newgrp docker

# For Windows/Mac: Reinstall Docker Desktop
```

### Problem: "Permission denied"
**Solution**: Add your user to Docker group
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Problem: "Port already in use"
**Solution**: Something else is using ports 3000 or 8000
```bash
# Stop other services or kill processes:
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:8000 | xargs kill -9
```

### Problem: "Cannot login" or "Invalid Token"
**Solution**: Wait for services to fully start, then try again
```bash
# Check if containers are running:
docker-compose -f docker-compose.dev.yml ps

# If they're running, wait 2-3 minutes and try logging in again
```

### Problem: Application loads but features don't work
**Solution**: Check the .env file
```bash
# Make sure your .env file has all your Azure credentials
cat .env

# The file should contain your actual Azure keys, not placeholder values
```

---

## 🎯 Summary: What You Accomplished

1. **✅ Installed Docker** on any computer/server
2. **✅ Copied your application** to the new system
3. **✅ Started everything with one command**: `./docker-start.sh`
4. **✅ Your app runs exactly the same** as on your original laptop
5. **✅ No need to install Python, Node.js, or any dependencies**
6. **✅ Works on Windows, Mac, Linux, and any cloud provider**

**The magic**: Your application is now **portable**. You can copy it to any system and it will work exactly the same way!

---

## 📞 Need Help?

If you get stuck:
1. **Check the error messages** carefully
2. **Try stopping and starting again**: `./docker-stop.sh` then `./docker-start.sh`
3. **Make sure your .env file is correct** and contains your actual Azure credentials
4. **Wait a few minutes** after starting - sometimes it takes time for everything to load

**Remember**: Once it works on one system, it will work the same way on ALL systems! 🎉