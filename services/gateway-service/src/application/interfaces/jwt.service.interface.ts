export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface IJwtService {
  sign(payload: JwtPayload): string;
  verify(token: string): JwtPayload;
}

export const JWT_SERVICE = Symbol('JWT_SERVICE');
