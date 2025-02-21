import { createContext } from 'react';
import { AuthContextData } from '../../types';

export const AuthContext = createContext<AuthContextData | undefined>(undefined);
