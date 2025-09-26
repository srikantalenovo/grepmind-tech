// frontend/src/components/Dashboard/Dashboard.js
import React, { useState } from "react";
import { TextField, IconButton, Paper } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

const Dashboard = () => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      console.log("User message:", message);
      setMessage("");
    }
  };

  return (
    <div className="dashboard-container" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Main dashboard content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <h2>Welcome to GrepMind Dashboard</h2>
        {/* Add your analyzer/resources/logs here */}
      </div>

      {/* Chat input box */}
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
          style={{
            marginLeft: "12px",
            marginRight: "8px",
          }}
        />
        <IconButton
          onClick={handleSend}
          color="primary"
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
