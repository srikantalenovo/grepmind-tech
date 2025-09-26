import React, { useState, useRef } from "react";
import { IconButton, Paper } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

const Dashboard = () => {
  const inputRef = useRef(null);

  const handleSend = () => {
    const text = inputRef.current.innerText.trim();
    if (!text) return;

    console.log("User message:", text);
    inputRef.current.innerText = ""; // clear after send
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Chat content above */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <h2>Welcome to GrepMind Dashboard</h2>
        {/* Messages will go here */}
      </div>

      {/* Composer at bottom */}
      <Paper
        elevation={3}
        style={{
          display: "flex",
          alignItems: "center",
          borderRadius: "28px",
          margin: "12px",
          padding: "8px 12px",
        }}
      >
        {/* Editable div instead of input */}
        <div
          ref={inputRef}
          contentEditable
          placeholder="Ask anything..."
          style={{
            flex: 1,
            minHeight: "40px",
            outline: "none",
            fontSize: "1rem",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {/* Send button */}
        <IconButton
          onClick={handleSend}
          style={{
            backgroundColor: "#1976d2",
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
