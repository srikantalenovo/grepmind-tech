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
# Install dependencies and start
npm install
npm start