import bcrypt from "bcrypt";
import { UserRepository } from "./users.repository.js";
import { CreateUserBody } from "./users.schema.js";
import { ConflictError } from "../../utils/errors.js";

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(data: CreateUserBody) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError(
        `User with email '${data.email}' already exists.`,
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    });
  }

  async getUserById(id: string) {
    return this.userRepository.findById(id);
  }
}
