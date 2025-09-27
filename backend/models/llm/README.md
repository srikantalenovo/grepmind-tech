# Minimal LLM Model Directory

Description: Minimal LLM for main prompt processing
Type: text-generation
Status: Development (using simulated responses)

Place your model files in this directory when ready.

## Supported Model Formats:
- TensorFlow.js models
- ONNX models
- Ollama models (recommended for minimal LLMs)
- HuggingFace transformers
- Custom lightweight models

## Current Configuration:
- Max Tokens: 500
- Temperature: 0.6
- Model Type: Text Generation

## Recommended Models for Production:
- Ollama: llama2:7b-chat (lightweight)
- TensorFlow.js: Universal Sentence Encoder
- ONNX: DistilBERT variants
- Custom: Fine-tuned small models

## Development Mode:
Currently using simulated responses for testing and development.
The model loader will automatically detect and load real models when placed in this directory.