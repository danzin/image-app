module.exports = {
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json"
    }]
  },
  preset: 'ts-jest',
  testEnvironment: 'node', 
  roots: ['./src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'], 

};