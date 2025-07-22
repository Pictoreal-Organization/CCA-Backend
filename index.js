const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 5000;
const meetingRoutes = require('./routes/meetings');

app.use('/', meetingRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});