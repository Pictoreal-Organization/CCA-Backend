const nodemailer = require('nodemailer');
require('dotenv').config(); // Load environment variables from .env file

// 1. Create the Transporter
// This is the object that connects to your email provider (like Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use 'gmail' for simplicity
  auth: {
    user: process.env.EMAIL_USER, // Your email from .env file
    pass: process.env.EMAIL_PASS, // Your App Password from .env file
  },
});

// 2. A generic function to send any email
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"PICTOREAL" <${process.env.EMAIL_USER}>`, // Sender display name
      to: to, // Recipient's email address
      subject: subject, // Subject line
      html: html, // Email body in HTML format
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    // In a real app, you might want more robust error handling here
  }
};

// 3. Specific email templates for different events

// Sent when a new task is created
exports.sendTaskCreationEmail = (task, assignedUsers) => {
  const subject = `🚀 New Task Assigned: ${task.title}`;
  const assignedNames = assignedUsers.map(u => u.username).join(', ');
  const html = `
    <h1>New Task: ${task.title}</h1>
    <p>A new task has been created and subtasks have been assigned.</p>
    <p><strong>Description:</strong> ${task.description}</p>
    <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
    <p><strong>Assigned To:</strong> ${assignedNames}</p>
    <p>Please log in to the app to view your subtasks.</p>
  `;

  // Send the email to all assigned members
  const recipientEmails = assignedUsers.map(u => u.email);
  if (recipientEmails.length > 0) {
    sendEmail(recipientEmails.join(','), subject, html);
  }
};

// Sent to the Head when a member completes a subtask
exports.sendSubtaskCompletionEmail = (subtask, member, headEmail) => {
  const subject = `✅ Subtask Completed: ${subtask.title}`;
  const html = `
    <h1>Subtask Completed by ${member.username}</h1>
    <p>The subtask "<strong>${subtask.title}</strong>" has been marked as completed and is ready for your review.</p>
    <p><strong>Member's Completion Note:</strong></p>
    <p><em>${subtask.description}</em></p>
    <p>Please log in to the dashboard to approve it or suggest changes.</p>
  `;
  sendEmail(headEmail, subject, html);
};

// Sent to a member when a Head suggests changes
exports.sendChangesSuggestedEmail = (subtask, member) => {
  const subject = `📝 Changes Suggested for: ${subtask.title}`;
  const html = `
    <h1>Changes Suggested for Subtask: ${subtask.title}</h1>
    <p>A head has reviewed your completed subtask and suggested some changes.</p>
    <p><strong>Feedback:</strong></p>
    <p><em>${subtask.description}</em></p>
    <p>The subtask status has been reverted to "Pending". Please review the feedback and resubmit.</p>
  `;
  sendEmail(member.email, subject, html);
};

exports.sendMainTaskCompletionEmail = (task, head, members) => {
  const subject = `🎉 Task Completed: ${task.title}`;
  const html = `
    <h1>Task Completed: ${task.title}</h1>
    <p>The main task "<strong>${task.title}</strong>" has been officially marked as completed by ${head.username}.</p>
    <p>This task has now been moved to your profile history.</p>
    <p>Thank you for your hard work and contribution!</p>
    <br>
    <p>- PICTOREAL</p>
  `;

  // Create a recipient list including the head and all involved members.
  const recipientEmails = [head.email, ...members.map(m => m.email)];
  sendEmail(recipientEmails.join(','), subject, html);
};

exports.sendMeetingCreationEmail = (meeting, organizer, recipients) => {
  const subject = `📅 New Meeting Scheduled: ${meeting.title}`;
  const locationOrLink = meeting.location
    ? `<p><strong>Location:</strong> ${meeting.location}</p>`
    : `<p><strong>Online Link:</strong> <a href="${meeting.onlineLink}">${meeting.onlineLink}</a></p>`;

  const html = `
    <h1>New Meeting Scheduled</h1>
    <p>You have been invited to a new meeting organized by ${organizer.username}.</p>
    <hr>
    <h2>${meeting.title}</h2>
    <p><strong>Description:</strong> ${meeting.description}</p>
    <p><strong>Date & Time:</strong> ${new Date(meeting.dateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
    ${locationOrLink}
    <p>Please check the app for more details and to confirm your attendance.</p>
  `;

  const recipientEmails = recipients.map(user => user.email);
  if (recipientEmails.length > 0) {
    sendEmail(recipientEmails.join(','), subject, html);
  }
};

exports.sendMeetingCancellationEmail = (meeting, organizer, recipients) => {
  const subject = `❌ Meeting Cancelled: ${meeting.title}`;
  const html = `
    <h1>Meeting Cancelled</h1>
    <p>The meeting <strong>"${meeting.title}"</strong> scheduled on 
    <strong>${new Date(meeting.dateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong> 
    has been cancelled by ${organizer.username}.</p>
    <hr>
    <p><strong>Reason (if any):</strong> This meeting will no longer take place as planned.</p>
    <p>We apologize for any inconvenience caused.</p>
    <br>
    <p>- PICTOREAL Team</p>
  `;

  const recipientEmails = recipients.map(user => user.email);
  if (recipientEmails.length > 0) {
    sendEmail(recipientEmails.join(','), subject, html);
  }
};
