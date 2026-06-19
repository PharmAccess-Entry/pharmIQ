import { Navigate } from "react-router-dom";

// Index is never mounted directly — App.tsx routes "/" to Home.tsx
// This file exists as a fallback; redirect to home.
const Index = () => <Navigate to="/" replace />;
export default Index;
