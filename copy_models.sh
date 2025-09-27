#!/bin/bash

# Quick Fix: Copy Model Files Script
# This script copies your model files from /root/grepmind-tech/ to /workspace/grepmind-tech/

echo "🔧 Copying model files to correct location..."

# Create destination directories if they don't exist
mkdir -p /workspace/grepmind-tech/backend/models/chat/
mkdir -p /workspace/grepmind-tech/backend/models/llm/

# Copy chat models
echo "📁 Copying chat models..."
if [ -d "/root/grepmind-tech/backend/models/chat/" ]; then
    cp -v /root/grepmind-tech/backend/models/chat/* /workspace/grepmind-tech/backend/models/chat/ 2>/dev/null || echo "No chat model files found"
fi

# Copy LLM models  
echo "📁 Copying LLM models..."
if [ -d "/root/grepmind-tech/backend/models/llm/" ]; then
    cp -v /root/grepmind-tech/backend/models/llm/* /workspace/grepmind-tech/backend/models/llm/ 2>/dev/null || echo "No LLM model files found"
fi

echo "✅ Model copy completed!"

# List what we have now
echo "📋 Chat models available:"
ls -lh /workspace/grepmind-tech/backend/models/chat/ | grep -v README

echo "📋 LLM models available:"  
ls -lh /workspace/grepmind-tech/backend/models/llm/ | grep -v README

echo "🚀 Now restart the backend server to use the local models!"