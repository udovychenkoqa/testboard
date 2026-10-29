import { DefaultUser } from 'next-auth';

import { type Role } from '@/app/lib/access';

declare module 'next-auth' {
  interface User extends DefaultUser {
    apiToken?: string;
    jwtToken?: string;
    role?: Role;
  }

  interface Session {
    user: {
      apiToken?: string;
      jwtToken?: string;
      role?: Role;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiToken?: string;
    jwtToken?: string;
    role?: Role;
    email?: string;
  }
}
