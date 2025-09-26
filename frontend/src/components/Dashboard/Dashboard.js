// frontend/src/components/Dashboard/Dashboard.js
import React, { useState } from "react";
import { TextField, IconButton, Paper } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

const Dashboard = () => {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      // Example API call (adjust endpoint if needed)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      console.log("Server response:", data);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    setMessage("");
  };

  return (
    <div className="dashboard-container" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Main dashboard content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <h2>Welcome to GrepMind Dashboard</h2>
        {/* analyzer/resources/logs content goes here */}
      </div>

      {/* Chat input section */}
      <Paper
        elevation={3}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderRadius: "50px",
          margin: "12px",
        }}
      >
        <TextField
          variant="standard"
          placeholder="Type your message..."
          fullWidth
          InputProps={{ disableUnderline: true }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{
            marginLeft: "12px",
            marginRight: "8px",
          }}
        />
        <IconButton
          onClick={handleSend}
          style={{
            backgroundColor: "#1976d2",
            color: "white",
            marginLeft: "8px",
          }}
        >
          <SendIcon />
        </IconButton>
      </Paper>
    </div>
  );
};

export default Dashboard;
