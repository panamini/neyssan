import React, { ReactNode } from "react";
import styles from "./CustomToggle.module.css";
import clsx from "clsx";
import { Star } from "lucide-react";

interface CustomToggleProps {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  isModelToggle?: boolean; // New prop to distinguish model toggle
  isCreativityToggle?: boolean; // Prop for creativity toggle
}

const CustomToggle: React.FC<CustomToggleProps> = ({
  options,
  value,
  onChange,
  isModelToggle = false,
  isCreativityToggle = false,
}) => {
  const handleClick = () => {
    if (isModelToggle) {
      const currentIndex = options.findIndex((option) => option.value === value);
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].value);
    }
  };

  if (isModelToggle) {
    return (
      <button
        type="button"
        className={clsx(styles.toggleButton, styles.modelToggle)}
        onClick={handleClick}
      >
        {options.find((option) => option.value === value)?.label || "Select..."}
      </button>
    );
  }

    if (isCreativityToggle) {
        const numStars = options.findIndex((option) => option.value === value) + 1;
    return (
      <div className={styles.toggleGroup}>
        {[...Array(3)].map((_, index) => (
          <button
            key={index}
            type="button"
            className={clsx(styles.toggleButton, {
              [styles.active]: index < numStars,
            })}
            onClick={() => {
              const nextValue = options[index].value;
              onChange(nextValue);
            }}
          >
            <Star
              size={16}
              className={clsx({
                "fill-current text-white": index < numStars,
              })}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.toggleGroup}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            styles.toggleButton,
            option.value === value ? styles.active : styles.inactive
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default CustomToggle;
