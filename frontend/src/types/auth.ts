export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager";
};

export type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
};