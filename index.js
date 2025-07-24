const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 5000;
const meetingRoutes = require('./routes/meetings');
const taskRoutes = require('./routes/tasks');
require('./db');


app.use(express.json());
app.use('/', meetingRoutes);
app.use('/', taskRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});