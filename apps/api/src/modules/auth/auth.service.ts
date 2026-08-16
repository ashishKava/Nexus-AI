import bcrypt from "bcrypt";
import { UserRepository } from "../users/users.repository.js";
import { SignupBody, LoginBody } from "./auth.schema.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";

export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async signup(data: SignupBody) {
    // 1. Check if email already registered
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError(`User with email '${data.email}' already exists.`);
    }

    // 2. Hash the password (using standard 10 salt rounds)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Save the new user in database
    return this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    });
  }

  async login(data: LoginBody) {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      // Use generic error message to prevent account enumeration attacks
      throw new UnauthorizedError("Invalid email or password.");
    }

    // 2. Verify password match
    const passwordMatch = await bcrypt.compare(data.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    return user;
  }
}
