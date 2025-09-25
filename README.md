# grepmind-tech
Set up the PostgreSQL database:
createdb grepmind_db
Then run the SQL commands from db.sql
Configure the backend:
Navigate to the backend directory
Create a .env file with your database credentials
Install dependencies and start the server:

npm install
npm run dev

Start the frontend:
cd frontend
# Clean up old dependencies
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules
Remove-Item -Force -ErrorAction SilentlyContinue package-lock.json
# Install dependencies
npm install

# For Linux/Mac users:
export NODE_OPTIONS=--openssl-legacy-provider
export HOST=0.0.0.0
# For Windows users:
set NODE_OPTIONS=--openssl-legacy-provider
set HOST=0.0.0.0

# Start the application
npm start

The application will be accessible at:
- Local: http://localhost:3000
- Network: http://0.0.0.0:3000
- On your LAN: http://<your-ip-address>:3000