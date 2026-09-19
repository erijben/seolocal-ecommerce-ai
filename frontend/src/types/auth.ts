export type UserRole = "admin" | "manager";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
};
