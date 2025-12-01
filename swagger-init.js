const swaggerAutogen = require("swagger-autogen")();
const fs = require("fs");

const outputFile = "./swagger-output.json";
const endpointsFiles = ["./index.js"];

const doc = {
  info: {
    title: "Pictoreal CCA Backend API",
    description: "Complete API Documentation for CCA Backend System"
  },
  host: "localhost:5001",
  schemes: ["http"],
  tags: [
    { name: "Authentication", description: "User authentication, login, logout, and password management" },
    { name: "Meetings", description: "Meeting management and scheduling" },
    { name: "Tasks", description: "Task management and tracking" },
    { name: "Users", description: "User profile management" },
    { name: "Admin", description: "Administrative operations (Admin only)" },
    { name: "Attendance", description: "Attendance tracking and management" },
    { name: "Teams", description: "Team management and collaboration" },
    { name: "Tags", description: "Tag management and categorization" }
  ]
};

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  // Read the generated swagger file
  const swaggerFile = JSON.parse(fs.readFileSync(outputFile, "utf8"));

  // Auto-tag routes based on path
  Object.keys(swaggerFile.paths).forEach(path => {
    Object.keys(swaggerFile.paths[path]).forEach(method => {
      if (path.startsWith("/api/auth")) {
        swaggerFile.paths[path][method].tags = ["Authentication"];
      } else if (path.startsWith("/api/meetings")) {
        swaggerFile.paths[path][method].tags = ["Meetings"];
      } else if (path.startsWith("/api/tasks")) {
        swaggerFile.paths[path][method].tags = ["Tasks"];
      } else if (path.startsWith("/api/user")) {
        swaggerFile.paths[path][method].tags = ["Users"];
      } else if (path.startsWith("/api/admin")) {
        swaggerFile.paths[path][method].tags = ["Admin"];
      } else if (path.startsWith("/api/attendance")) {
        swaggerFile.paths[path][method].tags = ["Attendance"];
      } else if (path.startsWith("/api/teams")) {
        swaggerFile.paths[path][method].tags = ["Teams"];
      } else if (path.startsWith("/api/tags")) {
        swaggerFile.paths[path][method].tags = ["Tags"];
      }
    });
  });

  // Write back the modified swagger file
  fs.writeFileSync(outputFile, JSON.stringify(swaggerFile, null, 2));
  console.log("✅ Swagger file generated and organized with tags!");
});