import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";
import connectDB from "./src/config/db.js";

dotenv.config();

const createAdmin = async () => {
  try {
    const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in .env first.");
    }

    await connectDB();
    console.log("Connected to MongoDB.");

    await User.findOneAndDelete({ username });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({
      username,
      password: hashedPassword,
    });

    console.log(`Admin user ready: ${username}`);
    console.log("Initial password was read from environment variables.");
    process.exit(0);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exit(1);
  }
};

createAdmin();
