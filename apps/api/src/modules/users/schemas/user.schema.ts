import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../../../common/enums';


export type UserDocument = User & Document;

@Schema({
  collection: 'users',
  timestamps: true, // Automatically manages createdAt and updatedAt
})
export class User {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name: string;

  /**
   * Email is the login identifier.
   * Must be unique and stored in lowercase (normalised at service level).
   * passwordHash must NEVER be returned via API responses.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  /**
   * Bcrypt hash of the owner's password.
   * Plain-text passwords must NEVER be stored.
   * This field must be excluded from all API response serialisation.
   */
  @Prop({
    type: String,
    required: true,
    select: false, // Excluded from query results by default
  })
  passwordHash: string;

  /** V1 has a single role. Field retained for future extensibility. */
  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.OWNER,
    required: true,
  })
  role: UserRole;

  /** Inactive users must not be allowed to authenticate. */
  @Prop({
    type: Boolean,
    default: true,
    required: true,
  })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);


// Note: email unique index is handled by @Prop({ unique: true }) above.
// No additional schema.index() call required to avoid duplicate index warnings.

