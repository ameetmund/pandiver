# 🚀 Complete Beginner's Guide: Deploy Pandiver to Azure Container Apps

## 📋 What We're Going to Do

You have a working version locally (V2025.09.22.01). We're going to:
1. ✅ Set up Azure cloud infrastructure
2. ✅ Configure automatic deployment pipelines
3. ✅ Deploy your app to staging and production
4. ✅ Set up monitoring and management

**Result**: Your app will automatically deploy to staging when you push code, and to production when you create releases.

---

## 🛠️ Step 1: Install Required Tools (15 minutes)

### 1.1 Install Azure CLI

**On Mac:**
```bash
brew install azure-cli
```

<!-- **On Windows:**
1. Download from: https://aka.ms/installazurecliwindows
2. Run the installer
3. Restart your terminal

**On Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
``` -->

**Verify installation:**
```bash
az --version
```
You should see version information.

### 1.2 Install Docker Desktop (if not already installed)

1. Go to https://www.docker.com/products/docker-desktop
2. Download for your operating system
3. Install and start Docker Desktop
4. Verify: `docker --version`

### 1.3 Ensure Git is Working

```bash
git --version
```

---

## 🌟 Step 2: Create Azure Account (10 minutes)

### 2.1 Sign Up for Azure
1. Go to https://azure.microsoft.com/free
2. Click "Start free"
3. Sign up with your Microsoft account (or create one)
4. **Important**: You get $200 free credits for 30 days!

### 2.2 Verify Your Account
1. Login to https://portal.azure.com
2. You should see the Azure dashboard

---

## 🚀 Step 3: Run the Automated Setup (20 minutes)

### 3.1 Navigate to Your Project
```bash
cd /Users/ameetmund/Tech/Project/pandiver-new.git/pandiver-new
```

### 3.2 Make Setup Script Executable
```bash
chmod +x setup-azure-container-apps.sh
```

### Run these commands to register all the services you'll need:

# Register Container Registry service
az provider register --namespace Microsoft.ContainerRegistry

# Register Container Apps service
az provider register --namespace Microsoft.App

# Register Log Analytics service
az provider register --namespace Microsoft.OperationalInsights

# Register SQL service
az provider register --namespace Microsoft.Sql

# Register Key Vault service
az provider register --namespace Microsoft.KeyVault

# Register Storage service
az provider register --namespace Microsoft.Storage

⏱️ Wait for Registration to Complete

# Check registration status (this might take 2-5 minutes)
az provider show --namespace Microsoft.ContainerRegistry --query
registrationState

You should see "Registered" when it's ready.

🔄 Check All Services Are Registered

# Check all required services
az provider list --query "[?namespace=='Microsoft.ContainerRegistry' 
|| namespace=='Microsoft.App' || 
namespace=='Microsoft.OperationalInsights' || 
namespace=='Microsoft.Sql' || 
namespace=='Microsoft.KeyVault' ||
namespace=='Microsoft.Storage'].{Namespace:namespace, 
State:registrationState}" --output table

Expected output:
Namespace                           State
----------------------------------  ----------
Microsoft.ContainerRegistry        Registered
Microsoft.App                       Registered
Microsoft.OperationalInsights       Registered
Microsoft.Sql                       Registered
Microsoft.KeyVault                  Registered


### 3.3 Run the Setup Script
```bash
./setup-azure-container-apps.sh
```

### 3.4 Follow the Setup Prompts

**The script will ask you several questions. Here's what to expect:**

1. **"Do you want to continue with this configuration?"**
   - Type: `y` and press Enter

2. **Azure Login**
   - A browser window will open
   - Login with your Azure account
   - You'll see "You have signed in to the Azure CLI"

3. **SQL Server Password**
   - Enter a strong password (write it down!)
   - Must have: uppercase, lowercase, number, special character
   - Example: `MyStrong123!Password`

4. **Azure Service Keys** (You can skip these for now):
   - **Azure Translator Key**: Press Enter to skip
   - **Azure Translator Region**: Press Enter to skip
   - **Azure Doc Intelligence Key**: Press Enter to skip
   - **Azure Doc Intelligence Endpoint**: Press Enter to skip

### 3.5 Save the Output

**VERY IMPORTANT**: At the end, the script will show you important information. **Copy and save this entire output** - you'll need it for GitHub!

Example output:
```
🔑 GitHub Secrets to Configure:
AZURE_CREDENTIALS: {"clientId":"xxx","clientSecret":"xxx",...}
KEY_VAULT_NAME: kv-pandiver-123456
ACR_NAME: pandiveracr123456
...
```

**📝 Action**: Copy all this information to a text file and save it!

---

## 🔧 Step 4: Configure GitHub Repository (15 minutes)

### 4.1 Go to Your GitHub Repository
1. Open your browser
2. Go to your Pandiver repository on GitHub
3. Click on **"Settings"** tab
4. In the left sidebar, click **"Secrets and variables"**
5. Click **"Actions"**

### 4.2 Add GitHub Secrets

Click **"New repository secret"** for each of these:

**Secret 1: AZURE_CREDENTIALS**
- Name: `AZURE_CREDENTIALS`
- Value: The entire JSON from the setup script output (starts with `{"clientId":`)

**Secret 2: KEY_VAULT_NAME**
- Name: `KEY_VAULT_NAME`
- Value: The key vault name from setup (e.g., `kv-pandiver-123456`)

**Secret 3: ACR_NAME**
- Name: `ACR_NAME`
- Value: The ACR name from setup (e.g., `pandiveracr123456`)

**Secret 4: PRODUCTION_SQL_SERVER**
- Name: `PRODUCTION_SQL_SERVER`
- Value: The SQL server name from setup (e.g., `pandiver-sql-123456`)

**Secret 5: PRODUCTION_DATABASE**
- Name: `PRODUCTION_DATABASE`
- Value: `pandiver-production-db`

**Secret 6: SQL_ADMIN_USER**
- Name: `SQL_ADMIN_USER`
- Value: `panadmin`

**Secret 7: SQL_ADMIN_PASSWORD**
- Name: `SQL_ADMIN_PASSWORD`
- Value: The password you created during setup

**Secret 8: STORAGE_ACCOUNT_KEY** (For now, use a placeholder)
- Name: `STORAGE_ACCOUNT_KEY`
- Value: `placeholder-will-add-later`

**Secret 9: STORAGE_ACCOUNT** (For now, use a placeholder)
- Name: `STORAGE_ACCOUNT`
- Value: `placeholder-will-add-later`

### 4.3 Create Environment Protection Rules

1. Go to **Settings** → **Environments**
2. Click **"New environment"**
3. Name: `staging`
4. Click **"Configure environment"**
5. ✅ Check **"Required reviewers"** (add yourself)
6. Save

7. Create another environment:
8. Name: `production`
9. ✅ Check **"Required reviewers"** (add yourself)
10. Save

---

## 🏗️ Step 5: Add Your Azure Service Keys (10 minutes)

### 5.1 Get Your Azure Keys

If you have Azure Translator and Document Intelligence services:

**For Azure Translator:**
1. Go to https://portal.azure.com
2. Search "Translator" → Create new Translator resource
3. Copy the **Key** and **Region**

**For Azure Document Intelligence:**
1. Search "Document Intelligence" → Create new resource
2. Copy the **Key** and **Endpoint**

### 5.2 Add Keys to Azure Key Vault

```bash
# Replace these with your actual values
ACR_NAME="your-acr-name-from-setup"  # e.g., pandiveracr123456
KEY_VAULT_NAME="your-keyvault-name-from-setup"  # e.g., kv-pandiver-123456

# Login to Azure
az login

# Add your Azure service keys
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-key" --value "YOUR_TRANSLATOR_KEY"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-region" --value "eastus"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-key" --value "YOUR_DOC_INTELLIGENCE_KEY"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-endpoint" --value "YOUR_DOC_INTELLIGENCE_ENDPOINT"
```

---

## 🚀 Step 6: Build and Push Your First Images (15 minutes)

### 6.1 Login to Your Container Registry

```bash
# Use the ACR name from your setup
ACR_NAME="your-acr-name-from-setup"  # Replace with actual name

az acr login --name $ACR_NAME
```

### 6.2 Build and Push Backend Image

```bash
# Make sure you're in the project directory
cd /Users/ameetmund/Tech/Project/pandiver-new.git/pandiver-new

# Build backend image
docker build -f docker/backend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-backend:latest ./backend

# Push backend image
docker push $ACR_NAME.azurecr.io/pandiver-backend:latest
```

### 6.3 Build and Push Frontend Image

```bash
# Build frontend image
docker build -f docker/frontend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-frontend:latest ./frontend

# Push frontend image
docker push $ACR_NAME.azurecr.io/pandiver-frontend:latest
```

**✅ Success**: You should see "Pushed" messages for both images.

---

## 🎯 Step 7: Deploy to Staging (10 minutes)

### 7.1 Commit and Push to Main Branch

```bash
# Make sure all your files are committed
git add .
git commit -m "Add Azure Container Apps deployment configuration"

# Push to main branch (this will trigger staging deployment)
git push origin main
```

### 7.2 Watch the Deployment

1. Go to your GitHub repository
2. Click **"Actions"** tab
3. You should see a workflow running: **"Deploy to Azure Container Apps (Staging)"**
4. Click on it to watch the progress

**⏱️ Expected time**: 10-15 minutes for first deployment

### 7.3 Check if Staging is Working

Once the GitHub Action completes:

1. Look for the output URLs in the action log
2. The staging URL will look like: `https://pandiver-frontend-staging--xxx.eastus.azurecontainerapps.io`
3. Open that URL in your browser
4. You should see your Pandiver application!

---

## 🌟 Step 8: Deploy to Production (5 minutes)

### 8.1 Create a Release Tag

```bash
# Create a version tag for production
git tag v1.0.0
git push origin v1.0.0
```

### 8.2 Create GitHub Release

1. Go to your GitHub repository
2. Click **"Releases"** on the right side
3. Click **"Create a new release"**
4. Choose tag: `v1.0.0`
5. Title: `Production Release v1.0.0`
6. Description: `Initial production deployment of Pandiver`
7. Click **"Publish release"**

### 8.3 Watch Production Deployment

1. Go to **Actions** tab
2. You should see: **"Deploy to Azure Container Apps (Production)"**
3. This needs **manual approval** - click **"Review deployments"** and approve

**⏱️ Expected time**: 15-20 minutes for production deployment

---

## 🎉 Step 9: Test Your Deployed Application (10 minutes)

### 9.1 Find Your Application URLs

**Staging URL**: Check the staging GitHub Action output

**Production URL**: Check the production GitHub Action output

### 9.2 Test the Application

1. **Open the production URL**
2. **Login with**: `ameetmund@gmail.com` / `temp123`
3. **Test features**:
   - ✅ Dashboard loads
   - ✅ API sections show API keys
   - ✅ PDF Page Splitter works
   - ✅ PDF Translator works (if you added Azure keys)

### 9.3 Monitor in Azure Portal

1. Go to https://portal.azure.com
2. Search for "Container Apps"
3. You should see your apps: `pandiver-backend-prod`, `pandiver-frontend-prod`
4. Click on them to see metrics, logs, etc.

---

## 🔄 Step 10: Understanding Your CI/CD Pipeline

### What Happens Now:

**When you push to `main` branch:**
- ✅ Automatically builds new images
- ✅ Deploys to staging environment
- ✅ Runs health checks
- ✅ Scales down to zero when not used (saves money!)

**When you create a release:**
- ✅ Builds production images
- ✅ Creates database backup
- ✅ Deploys to production with blue/green deployment
- ✅ Runs comprehensive health checks
- ✅ Automatically rolls back if something fails

**Cost Benefits:**
- 💰 Staging scales to zero = $0 cost when not used
- 💰 Production scales 1-10 based on traffic
- 💰 Estimated cost: ~$125/month total

---

## 🛟 Step 11: Common Issues & Solutions

### Issue 1: "az command not found"
**Solution**: Install Azure CLI (Step 1.1)

### Issue 2: "docker: command not found"
**Solution**: Install Docker Desktop (Step 1.2)

### Issue 3: "Login failed"
**Solution**: Run `az login` again

### Issue 4: Images fail to build
**Solution**:
```bash
# Clean Docker and try again
docker system prune -f
docker build --no-cache -f docker/backend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-backend:latest ./backend
```

### Issue 5: GitHub Action fails
**Solution**:
1. Check if all secrets are added correctly
2. Verify the secret values don't have extra spaces
3. Make sure environments are created

### Issue 6: Can't access the application
**Solution**:
1. Wait 5-10 minutes after deployment
2. Check GitHub Actions for the correct URL
3. Try accessing `/health` endpoint first

---

## 📋 Success Checklist

Before you're done, verify:

- [ ] ✅ Azure CLI installed and working
- [ ] ✅ Docker installed and working
- [ ] ✅ Azure account created
- [ ] ✅ Setup script completed successfully
- [ ] ✅ All GitHub secrets added
- [ ] ✅ Images built and pushed to ACR
- [ ] ✅ Staging deployment successful
- [ ] ✅ Production deployment successful
- [ ] ✅ Application accessible and working
- [ ] ✅ Login works with test credentials
- [ ] ✅ Core features functional

---

## 🎯 What You've Accomplished

🎉 **Congratulations!** You now have:

1. **Enterprise-grade infrastructure** on Azure
2. **Automated CI/CD pipeline** (Dev → Staging → Production)
3. **Auto-scaling** application that handles traffic spikes
4. **Cost-optimized** deployment (scales to zero when not used)
5. **Blue/green deployments** with automatic rollback
6. **Secure secrets management** with Azure Key Vault
7. **Professional monitoring** and logging

**Your app is now running in the cloud and ready for real users!** 🚀

---

## 📞 Need Help?

If you get stuck at any step:

1. **Check the error message** carefully
2. **Re-read the step** you're on
3. **Try the solution** in the "Common Issues" section
4. **Check GitHub Actions logs** for detailed error messages
5. **Verify all secrets** are correctly added

Remember: The first deployment always takes the longest. After this setup, deployments will be much faster and automatic!