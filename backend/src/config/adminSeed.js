import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const ensureConfiguredAdmin = async () => {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) return null;

  const existingUser = await User.findOne({ username });
  if (existingUser) return existingUser;

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    username,
    password: hashedPassword,
  });

  console.log(`AUTH: Admin user seeded for ${username}`);
  return user;
};
