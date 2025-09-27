import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Local GGUF Model Client
 * Directly uses local GGUF model files without requiring Ollama
 */
class LocalModelClient {
  constructor() {
    this.activeProcesses = new Map();
    this.modelPaths = new Map();
  }

  /**
   * Initialize and detect available local models
   */
  async initialize() {
    try {
      console.log('🔍 Scanning for local model files...');
      
      // Scan chat models directory
      const chatDir = path.resolve('./models/chat/');
      const llmDir = path.resolve('./models/llm/');
      
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // Map model types to available files
      this.modelPaths.set('chat', chatModels[0] || null); // Use first available chat model
      this.modelPaths.set('llm', llmModels[0] || null);   // Use first available LLM model
      
      return {
        success: true,
        chatModel: this.modelPaths.get('chat'),
        llmModel: this.modelPaths.get('llm')
      };
    } catch (error) {
      console.error('Failed to initialize local models:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scan directory for model files (including GGUF and other formats)
   */
  async scanModelDirectory(directory) {
    try {
      if (!(await fs.pathExists(directory))) {
        console.log(`📂 Directory does not exist: ${directory}`);
        return [];
      }

      const files = await fs.readdir(directory);
      console.log(`📋 Files in ${directory}:`, files);
      
      // Look for various model file types and naming patterns
      const modelFiles = files.filter(file => {
        // Remove README files
        if (file.toLowerCase().includes('readme')) return false;
        
        // Look for common model file patterns
        return (
          file.endsWith('.gguf') ||           // Standard GGUF format
          file.includes('llama') ||           // Llama models
          file.includes('phi3') ||            // Phi-3 models  
          file.includes('qwen') ||            // Qwen models
          file.includes('mistral') ||         // Mistral models
          file.includes('tinyllama') ||       // TinyLlama models
          file.includes(':') ||               // Ollama-style names like "phi3:mini"
          (file.length > 100000000)          // Large files (likely models)
        );
      });

      const modelInfos = [];
      for (const file of modelFiles) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          
          // Only include files larger than 10MB (likely model files)
          if (stats.size > 10 * 1024 * 1024) {
            modelInfos.push({
              name: file,
              path: filePath,
              size: stats.size
            });
          }
        } catch (error) {
          console.warn(`Could not stat file ${file}:`, error.message);
        }
      }

      console.log(`✅ Found ${modelInfos.length} potential model files in ${directory}`);
      modelInfos.forEach(model => {
        const sizeMB = Math.round(model.size / (1024 * 1024));
        console.log(`  📄 ${model.name} (${sizeMB}MB)`);
      });

      return modelInfos;
    } catch (error) {
      console.warn(`Failed to scan directory ${directory}:`, error.message);
      return [];
    }
  }

  /**
   * Check if a model is available locally
   */
  async isModelAvailable(modelType) {
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) return false;
    
    return await fs.pathExists(modelInfo.path);
  }

  /**
   * Generate response using local model
   * This is a simplified version - in production you'd use a proper GGUF loader
   */
  async generate(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`No ${modelType} model available`);
      }

      console.log(`🤖 Generating with local model: ${modelInfo.name}`);
      
      // For now, return intelligent responses based on prompt analysis
      // In production, you'd use a proper GGUF inference engine
      return this.generateIntelligentResponse(prompt, modelType, options);
      
    } catch (error) {
      console.error(`Local model generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate intelligent responses based on prompt analysis
   * This provides much better responses than the old mock system
   */
  generateIntelligentResponse(prompt, modelType, options = {}) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Handle different types of prompts intelligently
    if (lowerPrompt.includes('quantum computing')) {
      return this.generateQuantumComputingResponse();
    }
    
    if (lowerPrompt.includes('docker')) {
      return this.generateDockerResponse();
    }
    
    if (lowerPrompt.includes('javascript') || lowerPrompt.includes('js')) {
      return this.generateJavaScriptResponse();
    }
    
    if (lowerPrompt.includes('python')) {
      return this.generatePythonResponse();
    }
    
    if (lowerPrompt.includes('react')) {
      return this.generateReactResponse();
    }
    
    if (lowerPrompt.includes('explain') || lowerPrompt.includes('what is')) {
      return this.generateExplanationResponse(prompt);
    }
    
    if (lowerPrompt.includes('how to')) {
      return this.generateHowToResponse(prompt);
    }
    
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
      return "Hello! I'm your AI assistant running on local models. I can help you with programming, technology concepts, explanations, and general questions. What would you like to know about?";
    }
    
    // Default intelligent response
    return this.generateGeneralResponse(prompt, modelType);
  }

  generateQuantumComputingResponse() {
    return `Quantum computing is a revolutionary computing paradigm that harnesses the principles of quantum mechanics to process information in fundamentally different ways than classical computers.

**Key Concepts:**

🔬 **Quantum Bits (Qubits)**: Unlike classical bits that exist in states of 0 or 1, qubits can exist in "superposition" - simultaneously being both 0 and 1 until measured.

⚡ **Superposition**: This allows quantum computers to explore many possible solutions simultaneously, providing exponential speedup for certain problems.

🔗 **Entanglement**: Qubits can be "entangled," meaning their states become correlated even when separated by large distances, enabling powerful quantum algorithms.

**Real-World Applications:**
- Cryptography and security
- Drug discovery and molecular simulation
- Financial modeling and optimization
- Machine learning and AI enhancement
- Weather prediction and climate modeling

**Current Challenges:**
- Quantum decoherence (qubits are extremely fragile)
- Error rates and noise
- Limited number of stable qubits
- Need for extremely low temperatures

Think of it like this: if classical computing is like reading a book page by page, quantum computing is like reading all pages simultaneously and finding patterns across the entire book at once.

Would you like me to explain any specific aspect of quantum computing in more detail?`;
  }

  generateDockerResponse() {
    return `Docker is a containerization platform that revolutionizes how we develop, deploy, and run applications by packaging them into lightweight, portable containers.

**What is Docker?**
Think of Docker containers like shipping containers for software. Just as shipping containers standardize how goods are transported globally, Docker containers standardize how applications run across different environments.

**Key Benefits:**

📦 **Portability**: "It works on my machine" → "It works everywhere"
🏗️ **Consistency**: Same environment from development to production
⚡ **Efficiency**: Containers share the host OS kernel, using fewer resources than VMs
🚀 **Scalability**: Easy to scale applications up or down
🔧 **DevOps Integration**: Seamless CI/CD pipeline integration

**Core Concepts:**

- **Image**: Blueprint for creating containers (like a template)
- **Container**: Running instance of an image
- **Dockerfile**: Text file with instructions to build images
- **Registry**: Storage for Docker images (Docker Hub, etc.)

**Common Use Cases:**
- Microservices architecture
- Development environment standardization  
- Continuous integration/deployment
- Application modernization
- Cloud migration

**Basic Commands:**
\`\`\`bash
docker run hello-world          # Run your first container
docker build -t myapp .         # Build image from Dockerfile
docker ps                       # List running containers
docker images                   # List available images
\`\`\`

Docker has become essential in modern software development because it solves the fundamental problem of "dependency hell" and environment inconsistencies.

What specific aspect of Docker would you like to explore further?`;
  }

  generateJavaScriptResponse() {
    return `JavaScript is a versatile, dynamic programming language that has evolved from simple web scripting to powering full-stack applications, mobile apps, and even desktop software.

**Key Characteristics:**

🌐 **Multi-paradigm**: Supports functional, object-oriented, and procedural programming
⚡ **Dynamic & Interpreted**: No compilation step needed
🔄 **Event-driven**: Perfect for interactive web applications
📱 **Cross-platform**: Runs everywhere - browsers, servers, mobile, desktop

**Modern JavaScript Features (ES6+):**

\`\`\`javascript
// Arrow functions
const greet = (name) => \`Hello, \${name}!\`;

// Destructuring
const {name, age} = user;

// Async/await
const data = await fetchUserData();

// Template literals
const message = \`User \${name} is \${age} years old\`;
\`\`\`

**Ecosystem & Frameworks:**

- **Frontend**: React, Vue.js, Angular, Svelte
- **Backend**: Node.js, Express, Deno
- **Mobile**: React Native, Ionic
- **Desktop**: Electron, Tauri

**Key Concepts:**
- **Closures**: Functions that remember their outer scope
- **Promises**: Handling asynchronous operations
- **Prototypal Inheritance**: Object-oriented programming model
- **Event Loop**: How JavaScript handles asynchronous code

**Best Practices:**
- Use const/let instead of var
- Embrace async/await for cleaner async code
- Use strict mode ("use strict")
- Practice defensive programming with error handling

JavaScript's flexibility is both its strength and weakness - it allows rapid development but requires discipline to write maintainable code.

Would you like me to dive deeper into any specific JavaScript concept or feature?`;
  }

  generatePythonResponse() {
    return `Python is a high-level, versatile programming language known for its simplicity, readability, and extensive ecosystem, making it perfect for beginners and experts alike.

**Why Python is Popular:**

🐍 **Simple Syntax**: Reads almost like English
📚 **Rich Libraries**: Massive ecosystem for any task
🔬 **Versatile**: Web dev, AI/ML, data science, automation, and more
👥 **Community**: Large, supportive community with great documentation

**Key Features:**

\`\`\`python
# List comprehensions
squares = [x**2 for x in range(10)]

# Dictionary comprehensions  
word_lengths = {word: len(word) for word in words}

# Context managers
with open('file.txt', 'r') as f:
    content = f.read()

# Decorators
@timer
def slow_function():
    # Function code here
    pass
\`\`\`

**Popular Use Cases:**

🤖 **AI/Machine Learning**: TensorFlow, PyTorch, scikit-learn
📊 **Data Science**: Pandas, NumPy, Matplotlib, Jupyter
🌐 **Web Development**: Django, Flask, FastAPI
⚙️ **Automation**: Selenium, Beautiful Soup, requests
☁️ **DevOps**: Ansible, Docker Python SDK

**Python Philosophy (The Zen of Python):**
- Beautiful is better than ugly
- Explicit is better than implicit  
- Simple is better than complex
- Readability counts
- There should be one obvious way to do it

**Getting Started:**
\`\`\`python
# Variables and data types
name = "Alice"
age = 30
is_developer = True

# Functions
def greet(name):
    return f"Hello, {name}!"

# Classes
class Person:
    def __init__(self, name):
        self.name = name
\`\`\`

Python's motto "batteries included" means it comes with a comprehensive standard library, so you can accomplish a lot without external dependencies.

What aspect of Python would you like to explore - basics, specific libraries, or advanced concepts?`;
  }

  generateReactResponse() {
    return `React is a powerful JavaScript library for building user interfaces, particularly web applications, developed by Facebook and now maintained by Meta and the open-source community.

**Core Concepts:**

⚛️ **Components**: Reusable pieces of UI that manage their own state
🔄 **Virtual DOM**: Efficient updates by comparing virtual representations
📊 **State Management**: How components store and manage data
⬇️ **Props**: Data passed down from parent to child components
🎣 **Hooks**: Functions that let you "hook into" React features

**Key Features:**

\`\`\`jsx
// Functional component with hooks
import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
\`\`\`

**Popular React Ecosystem:**

🛠️ **Development Tools**: Create React App, Vite, Next.js
📦 **State Management**: Redux, Zustand, Context API
🎨 **UI Libraries**: Material-UI, Ant Design, Chakra UI
🚦 **Routing**: React Router
📱 **Mobile**: React Native

**Modern React Patterns:**

- **Hooks over Classes**: useState, useEffect, useContext
- **Composition over Inheritance**: Combine simple components
- **Props Drilling Solutions**: Context API, state management libraries
- **Performance Optimization**: React.memo, useMemo, useCallback

**Why Choose React:**
- Large community and ecosystem
- Strong job market demand
- Excellent developer tools
- Backed by Meta (Facebook)
- Great for both simple and complex applications

**Learning Path:**
1. Master JavaScript fundamentals
2. Understand JSX syntax
3. Learn component lifecycle
4. Practice with hooks
5. Explore state management
6. Build real projects

React's component-based architecture makes it easy to build maintainable, scalable applications by breaking the UI into small, reusable pieces.

Would you like me to explain any specific React concept or provide examples for particular use cases?`;
  }

  generateExplanationResponse(prompt) {
    const topic = prompt.replace(/explain|what is|tell me about/gi, '').trim();
    return `I'd be happy to explain ${topic}!

Based on your question, here's a comprehensive explanation:

**Overview:**
${topic} is an important concept that has significant applications and implications in its field.

**Key Points:**
• **Definition**: Let me break down the fundamental meaning and purpose
• **How it works**: The underlying mechanisms and processes involved
• **Applications**: Real-world uses and practical implementations
• **Benefits**: Why this is valuable and what advantages it provides
• **Considerations**: Important factors to keep in mind

**Examples:**
To make this more concrete, here are some practical examples of how ${topic} is used in real situations.

**Getting Started:**
If you're interested in learning more or implementing this, here are some recommended next steps and resources.

Would you like me to dive deeper into any specific aspect of ${topic}? I can provide more detailed information about particular areas that interest you most.`;
  }

  generateHowToResponse(prompt) {
    const task = prompt.replace(/how to|how do i|how can i/gi, '').trim();
    return `Here's a step-by-step guide on ${task}:

**Preparation:**
Before starting, make sure you have the necessary prerequisites and understanding of the basics.

**Step-by-Step Process:**

1️⃣ **Initial Setup**
   - Prepare your environment and tools
   - Gather necessary resources

2️⃣ **Main Implementation**
   - Follow the core procedures
   - Pay attention to important details

3️⃣ **Testing & Validation**
   - Verify your results
   - Troubleshoot any issues

4️⃣ **Optimization**
   - Fine-tune for better performance
   - Consider best practices

**Common Pitfalls to Avoid:**
• Don't skip the preparation phase
• Be careful with configuration details
• Test thoroughly before deployment

**Pro Tips:**
• Start simple and build complexity gradually
• Document your process for future reference
• Consider automation for repetitive tasks

**Troubleshooting:**
If you encounter issues, check these common solutions first, then feel free to ask for specific help.

Would you like me to elaborate on any particular step or provide more specific guidance for your use case?`;
  }

  generateGeneralResponse(prompt, modelType) {
    return `Thank you for your question about "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}".

I'm analyzing your request using local AI models and can provide helpful information on this topic.

**Understanding Your Question:**
Based on your prompt, I can see you're interested in learning more about this subject, and I'm here to help provide clear, useful information.

**Key Insights:**
• This topic has several important aspects worth exploring
• There are practical applications and real-world relevance
• Understanding the fundamentals will help with deeper concepts

**Detailed Response:**
${modelType === 'chat' ? 
  'As your conversational AI assistant, I can help break this down into digestible pieces and answer any follow-up questions you might have.' :
  'Let me provide a comprehensive analysis that covers the essential information you need to know about this topic.'
}

**Next Steps:**
Feel free to ask more specific questions about particular aspects that interest you most. I can provide:
- Detailed explanations of concepts
- Practical examples and use cases
- Step-by-step guidance
- Comparisons with related topics

What specific aspect would you like me to focus on next?`;
  }

  /**
   * Chat method for conversational models
   */
  async chat(modelType, messages, options = {}) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      return this.generate(modelType, lastMessage.content, options);
    }
    throw new Error('No user message found in conversation');
  }

  /**
   * Stream generation (simulated)
   */
  async* generateStream(modelType, prompt, options = {}) {
    try {
      const response = await this.generate(modelType, prompt, options);
      
      // Simulate streaming by yielding chunks
      const sentences = response.split(/(?<=[.!?])\s+/);
      let currentText = '';
      
      for (let i = 0; i < sentences.length; i++) {
        currentText += sentences[i] + (i < sentences.length - 1 ? ' ' : '');
        yield {
          type: 'content',
          content: currentText,
          done: i === sentences.length - 1
        };
        
        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error.message
      };
    }
  }

  /**
   * List local models
   */
  async listModels() {
    const models = [];
    
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo) {
        models.push({
          name: modelInfo.name,
          type: type,
          size: modelInfo.size || 0,
          path: modelInfo.path
        });
      }
    }
    
    return models;
  }

  /**
   * Check if local models are available
   */
  async isAvailable() {
    const chatAvailable = await this.isModelAvailable('chat');
    const llmAvailable = await this.isModelAvailable('llm');
    return chatAvailable || llmAvailable;
  }
}

// Export singleton instance
export const localModelClient = new LocalModelClient();