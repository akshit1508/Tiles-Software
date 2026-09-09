import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import { UserRole } from '../common/enums';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/goverdhan-traders';

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: ADMIN_PASSWORD must be at least 8 characters long for production security.');
    process.exit(1);
  }

  console.log(`[Seed Admin] Connecting to database...`);
  await mongoose.connect(dbUrl);

  const UserModel = mongoose.model<User>(User.name, UserSchema);

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[Seed Admin] Preparing owner account for: ${normalizedEmail}`);

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const existingUser = await UserModel.findOne({ email: normalizedEmail }).exec();

  if (existingUser) {
    existingUser.passwordHash = passwordHash;
    existingUser.role = UserRole.OWNER;
    existingUser.isActive = true;
    await existingUser.save();
    console.log(`[Seed Admin] Existing owner account updated successfully.`);
  } else {
    await UserModel.create({
      name: 'Goverdhan Owner',
      email: normalizedEmail,
      passwordHash,
      role: UserRole.OWNER,
      isActive: true,
    });
    console.log(`[Seed Admin] Owner account created successfully.`);
  }

  await mongoose.disconnect();
  console.log(`[Seed Admin] Complete.`);
}

seedAdmin().catch(async (err) => {
  console.error('Failed to seed admin:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
