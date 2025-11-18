const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generic reusable mail sender
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"PICTOREAL" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent");
  } catch (err) {
    console.error("Email sending error:", err);
    throw new Error("Email send failed");
  }
};

// 🔹 OTP Email
exports.sendOtpEmail = async (email, otp) => {
  const html = `
    <h2>Your OTP for Password Change</h2>
    <p>Your OTP is:</p>
    <h1 style="letter-spacing: 5px">${otp}</h1>
    <p>This OTP is valid for 10 minutes.</p>
  `;
  await sendEmail(email, "OTP for Password Change", html);
};

exports.sendTaskCreationEmail = (task, assignedUsers) => {
  const subject = `🚀 New Task Assigned: ${task.title}`;
  const assignedNames = assignedUsers.map(u => u.username).join(', ');

  const html = `
    <h1>New Task: ${task.title}</h1>
    <p>A new task has been created and subtasks have been assigned.</p>
    <p><strong>Description:</strong> ${task.description}</p>
    <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
    <p><strong>Assigned To:</strong> ${assignedNames}</p>
  `;

  const recipientEmails = assignedUsers.map(u => u.email);
  return sendEmail(recipientEmails.join(','), subject, html);
};

exports.sendSubtaskCompletionEmail = (subtask, member, headEmail) => {
  const subject = `✅ Subtask Completed: ${subtask.title}`;
  const html = `
    <h1>Subtask Completed by ${member.username}</h1>
    <p>The subtask "<strong>${subtask.title}</strong>" has been marked as completed.</p>
  `;

  return sendEmail(headEmail, subject, html);
};

exports.sendChangesSuggestedEmail = (subtask, member) => {
  const subject = `📝 Changes Suggested: ${subtask.title}`;
  const html = `
    <h1>Changes Suggested</h1>
    <p>Your subtask "${subtask.title}" needs some updates.</p>
  `;

  return sendEmail(member.email, subject, html);
};

exports.sendMainTaskCompletionEmail = (task, head, members) => {
  const subject = `🎉 Task Completed: ${task.title}`;
  const html = `
    <h1>${task.title} - Completed</h1>
    <p>Great job team!</p>
  `;

  const emails = [head.email, ...members.map(m => m.email)];
  return sendEmail(emails.join(','), subject, html);
};

exports.sendMeetingCreationEmail = (meeting, organizer, recipients) => {
  const subject = `📅 New Meeting: ${meeting.title}`;
  const html = `
    <h1>${meeting.title}</h1>
    <p>Organized by ${organizer.username}</p>
  `;

  const emails = recipients.map(r => r.email);
  return sendEmail(emails.join(','), subject, html);
};
