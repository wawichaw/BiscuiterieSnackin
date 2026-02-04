import jwt from 'jsonwebtoken';

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret_par_defaut_changez_moi',
    {
      expiresIn: process.env.JWT_EXPIRE || '24h',
    }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_par_defaut_changez_moi'
    );
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
};

