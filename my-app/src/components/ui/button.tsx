import React from "react";
import { Button } from "@radix-ui/themes";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const CustomButton: React.FC<ButtonProps> = ({ children, onClick, disabled }) => {
  return (
    <Button onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
};

export default CustomButton;
