// frontend/src/Dashboard.js
import React, { useState } from "react";
import {
  Box,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

function Dashboard() {
  const [message, setMessage] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    console.log("Send:", message);
    setMessage("");
  };

  return (
    <Box className="flex flex-col h-screen">
      {/* Main content */}
      <Box className="flex-1 overflow-y-auto p-6">
        <Typography variant="h5" gutterBottom>
          Dashboard Content
        </Typography>
        {/* Here goes AnalyzerView / ResourcesView / LogsView */}
      </Box>

      {/* Chat composer pinned at bottom */}
      <Box
        component="form"
        onSubmit={handleSend}
        className="w-full px-4 pb-4"
      >
        <Paper
          elevation={3}
          className="flex items-center px-4 py-2 rounded-full shadow-md bg-white dark:bg-[#303030]"
          style={{ borderRadius: "28px" }}
        >
          {/* Editable message box */}
          <div
            contentEditable
            suppressContentEditableWarning
            className="flex-1 outline-none text-gray-800 dark:text-gray-100 max-h-40 overflow-y-auto"
            data-placeholder="Ask anything..."
            onInput={(e) => setMessage(e.currentTarget.textContent)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          >
            {message}
          </div>

          {/* Send button */}
          <IconButton
            type="submit"
            color="primary"
            className="ml-2 rounded-full"
          >
            <ArrowUpwardIcon />
          </IconButton>
        </Paper>
      </Box>
    </Box>
  );
}

export default Dashboard;
