// frontend/src/components/Dashboard/Dashboard.js
import React, { useState } from "react";
import { IconButton, Paper, InputBase } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

const Dashboard = () => {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
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
    <div
      className="dashboard-container"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Main dashboard content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <h2>Welcome to GrepMind Dashboard</h2>
        {/* analyzer/resources/logs content goes here */}
      </div>

      {/* Chat input fixed at bottom */}
      <Paper
        elevation={3}
        style={{
          display: "flex",
          alignItems: "center",
          borderRadius: "999px", // full oval
          padding: "8px 12px",
          margin: "12px",
          position: "sticky",
          bottom: 0,
          backgroundColor: "#fff",
        }}
      >
        <InputBase
          placeholder="Type your message..."
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{ marginLeft: "12px", fontSize: "1rem" }}
        />
        <IconButton
          onClick={handleSend}
          style={{
            backgroundColor: "#ff416c",
            color: "white",
            marginLeft: "8px",
          }}
        >
          <ArrowUpwardIcon />
        </IconButton>
      </Paper>
    </div>
  );
};

export default Dashboard;
