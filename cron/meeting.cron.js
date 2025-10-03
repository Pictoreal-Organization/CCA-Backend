const cron = require("node-cron");
const Meeting = require("../models/meeting.model"); // import your model

cron.schedule("* * * * *", async () => {
  const now = new Date();

  // Scheduled
  await Meeting.updateMany(
    { status: { $ne: "cancelled" }, dateTime: { $gt: now } },
    { status: "scheduled" }
  );

  // Ongoing
  await Meeting.updateMany(
    {
      status: { $ne: "cancelled" },
      dateTime: { $lte: now },
      $expr: {
        $gte: [{ $add: ["$dateTime", { $multiply: ["$duration", 60000] }] }, now],
      },
    },
    { status: "ongoing" }
  );

  // Completed
  await Meeting.updateMany(
    {
      status: { $ne: "cancelled" },
      $expr: {
        $lt: [{ $add: ["$dateTime", { $multiply: ["$duration", 60000] }] }, now],
      },
    },
    { status: "completed" }
  );

  console.log("✅ Meeting statuses updated at", now);
});
