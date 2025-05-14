@echo off
REM ================================================
REM MongoDB Replica Set Reset Script for Windows
REM ================================================

echo.
echo MongoDB Replica Set Reset Script
echo ===============================
echo.
echo This script will:
echo 1. Stop and remove MongoDB container
echo 2. Remove MongoDB data volume
echo 3. Start a fresh MongoDB instance with replica set enabled
echo.

:ASK_CONFIRMATION
set /p CONFIRM="Are you sure you want to proceed? This will DELETE ALL MongoDB data! (y/n): "
if /i "%CONFIRM%" == "y" goto PROCEED
if /i "%CONFIRM%" == "n" goto CANCEL
echo Please answer y or n.
goto ASK_CONFIRMATION

:CANCEL
echo.
echo Operation cancelled.
exit /b 0

:PROCEED
echo.
echo Stopping MongoDB container...
docker stop mongo

echo.
echo Removing MongoDB container...
docker rm mongo

echo.
echo Removing MongoDB data volume...
docker volume rm mongo_data

echo.
echo Starting MongoDB with replica set enabled...
docker-compose up -d mongo

echo.
echo Waiting 30 seconds for MongoDB to initialize...
timeout /t 30 /nobreak > nul

echo.
echo Checking MongoDB replica set status...
docker exec -it mongo mongosh --eval "rs.status()" admin

echo.
echo If you see "MongoServerError: not running with --replSet" or "NotYetInitialized", try:
echo docker exec -it mongo mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo:27017'}]})" admin

echo.
echo Completed! You may need to wait a minute for MongoDB to fully initialize.
echo You can check the logs with: docker logs mongo
echo.