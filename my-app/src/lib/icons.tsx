import React from "react";
import {
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsOutSimple as PhArrowsOutSimple,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowDown as PhArrowDown,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowUp as PhArrowUp,
  Camera as PhCamera,
  CaretDown as PhCaretDown,
  CaretUp as PhCaretUp,
  Check as PhCheck,
  ClipboardText as PhClipboardText,
  SealWarning as PhSealWarning,
  CornersIn as PhCornersIn,
  Copy as PhCopy,
  DotsThree as PhDotsThree,
  DotsSixVertical as PhDotsSixVertical,
  Eye as PhEye,
  EyeClosed as PhEyeClosed,
  Eyedropper as PhEyedropper,
  Feather as PhFeather,
  FileImage as PhFileImage,
  FilePdf as PhFilePdf,
  FileText as PhFileText,
  FloppyDisk as PhFloppyDisk,
  IdentificationCard as PhIdentificationCard,
  Layout as PhLayout,
  Lightning as PhLightning,
  Link as PhLink,
  ListBullets as PhListBullets,
  MagicWand as PhMagicWand,
  Moon as PhMoon,
  MagnifyingGlass as PhMagnifyingGlass,
  MagnifyingGlassMinus as PhMagnifyingGlassMinus,
  MagnifyingGlassPlus as PhMagnifyingGlassPlus,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Paperclip as PhPaperclip,
  Palette as PhPalette,
  Pen as PhPen,
  PenNib as PhPenNib,
  PencilSimple as PhPencilSimple,
  PencilSimpleLine as PhPencilSimpleLine,
  Plug as PhPlug,
  Minus as PhMinus,
  Plus as PhPlus,
  PuzzlePiece as PhPuzzlePiece,
  PushPin as PhPushPin,
  PushPinSlash as PhPushPinSlash,
  Question as PhQuestion,
  Rewind as PhRewind,
  Rows as PhRows,
  Scan as PhScan,
  Scroll as PhScroll,
  SidebarSimple as PhSidebarSimple,
  SpinnerGap as PhSpinnerGap,
  Stop as PhStop,
  ImagesSquare as PhImagesSquare,
  SquaresFour as PhSquaresFour,
  Square as PhSquare,
  Star as PhStar,
  Sun as PhSun,
  Sunglasses as PhSunglasses,
  Stamp as PhStamp,
  TextB as PhTextB,
  TextItalic as PhTextItalic,
  TextUnderline as PhTextUnderline,
  Trash as PhTrash,
  TreeView as PhTreeView,
  Upload as PhUpload,
  User as PhUser,
  UserCircle as PhUserCircle,
  BracketsSquare as PhBracketsSquare,
  Gear as PhGear,
  X as PhX,
  type IconProps as PhosphorIconProps,
} from "@phosphor-icons/react";

type CompatIconProps = PhosphorIconProps & {
  strokeWidth?: number;
};

type CompatIcon = React.ForwardRefExoticComponent<
  CompatIconProps & React.RefAttributes<SVGSVGElement>
>;

function resolveWeight(
  strokeWidth?: number,
): NonNullable<PhosphorIconProps["weight"]> {
  if (typeof strokeWidth !== "number") {
    return "regular";
  }
  if (strokeWidth >= 2.2) {
    return "bold";
  }
  if (strokeWidth >= 1.8) {
    return "regular";
  }
  return "light";
}

function withCompat(
  Component: React.ComponentType<PhosphorIconProps>,
  defaultWeight: NonNullable<PhosphorIconProps["weight"]> = "regular",
): CompatIcon {
  const Wrapped = React.forwardRef<SVGSVGElement, CompatIconProps>(
    ({ strokeWidth, weight, ...props }, ref) => (
      <Component
        ref={ref}
        {...props}
        weight={weight ?? resolveWeight(strokeWidth) ?? defaultWeight}
      />
    ),
  );

  Wrapped.displayName =
    Component.displayName ?? Component.name ?? "PhosphorCompatIcon";

  return Wrapped;
}

export type { CompatIconProps as IconProps };

export const ArrowLeft = withCompat(PhArrowLeft);
export const ArrowRight = withCompat(PhArrowRight);
export const ArrowDown = withCompat(PhArrowDown);
export const ArrowSquareOut = withCompat(PhArrowSquareOut);
export const ArrowUp = withCompat(PhArrowUp);
export const ArrowsOutSimple = withCompat(PhArrowsOutSimple);
export const Bold = withCompat(PhTextB);
export const Camera = withCompat(PhCamera);
export const CaretDownIcon = withCompat(PhCaretDown);
export const CaretUpIcon = withCompat(PhCaretUp);
export const Check = withCompat(PhCheck);
export const ClipboardText = withCompat(PhClipboardText);
export const ChevronDown = withCompat(PhCaretDown);
export const ChevronUp = withCompat(PhCaretUp);
export const Copy = withCompat(PhCopy);
export const CornersIn = withCompat(PhCornersIn);
export const DotsThree = withCompat(PhDotsThree);
export const Eye = withCompat(PhEye);
export const EyeClosed = withCompat(PhEyeClosed);
export const EyeDropper = withCompat(PhEyedropper);
export const Feather = withCompat(PhFeather);
export const FileImage = withCompat(PhFileImage);
export const FilePdf = withCompat(PhFilePdf);
export const FileText = withCompat(PhFileText);
export const FileUser = withCompat(PhIdentificationCard);
export const ReadCvLogo = withCompat(PhIdentificationCard);
export const FloppyDisk = withCompat(PhFloppyDisk);
export const FolderTree = withCompat(PhTreeView);
export const GripHorizontal = withCompat(PhDotsSixVertical);
export const Italic = withCompat(PhTextItalic);
export const Layout = withCompat(PhLayout);
export const Lightning = withCompat(PhLightning);
export const Link = withCompat(PhLink);
export const List = withCompat(PhListBullets);
export const Loader2 = withCompat(PhSpinnerGap, "bold");
export const MagnifyingGlass = withCompat(PhMagnifyingGlass);
export const MagnifyingGlassMinus = withCompat(PhMagnifyingGlassMinus);
export const MagnifyingGlassPlus = withCompat(PhMagnifyingGlassPlus);
export const Menu = withCompat(PhRows);
export const Minus = withCompat(PhMinus);
export const Moon = withCompat(PhMoon);
export const Paperclip = withCompat(PhPaperclip);
export const Palette = withCompat(PhPalette);
export const PanelLeftDashed = withCompat(PhSidebarSimple);
export const Pen = withCompat(PhPen);
export const PenNib = withCompat(PhPenNib);
export const PenLine = withCompat(PhPencilSimpleLine);
export const Pencil = withCompat(PhPencilSimple);
export const Pin = withCompat(PhPushPin);
export const PinOff = withCompat(PhPushPinSlash);
export const Plus = withCompat(PhPlus);
export const Plug = withCompat(PhPlug);
export const PuzzlePiece = withCompat(PhPuzzlePiece);
export const Question = withCompat(PhQuestion);
export const Rewind = withCompat(PhRewind);
export const RotateCcw = withCompat(PhArrowsClockwise);
export const ScanLine = withCompat(PhScan);
export const ScrollText = withCompat(PhScroll);
export const SealWarning = withCompat(PhSealWarning);
export const SendHorizontal = withCompat(PhPaperPlaneTilt);
export const Square = withCompat(PhSquare);
export const ImagesSquare = withCompat(PhImagesSquare);
export const SquaresFour = withCompat(PhSquaresFour);
export const Star = withCompat(PhStar);
export const Stop = withCompat(PhStop);
export const Sun = withCompat(PhSun);
export const SunMedium = withCompat(PhSun);
export const Sunglasses = withCompat(PhSunglasses);
export const Stamp = withCompat(PhStamp);
export const Trash = withCompat(PhTrash);
export const Underline = withCompat(PhTextUnderline);
export const Upload = withCompat(PhUpload);
export const User = withCompat(PhUser);
export const UserRound = withCompat(PhUserCircle);
export const Wand2 = withCompat(PhMagicWand);
export const BracketsSquare = withCompat(PhBracketsSquare);
export const Gear = withCompat(PhGear);
export const X = withCompat(PhX);

export const ColorWheel = React.forwardRef<SVGSVGElement, CompatIconProps>(
  ({ size = 16, ...props }, ref) => {
    const clipPathId = React.useId();

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <defs>
          <clipPath id={clipPathId}>
            <circle cx="12" cy="12" r="10" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipPathId})`}>
          <path d="M12 12V2A10 10 0 0 1 20.66 7L12 12Z" fill="#F41422" />
          <path d="M12 12L20.66 7A10 10 0 0 1 20.66 17L12 12Z" fill="#FF9C1A" />
          <path d="M12 12L20.66 17A10 10 0 0 1 12 22V12Z" fill="#FFEF16" />
          <path d="M12 12V22A10 10 0 0 1 3.34 17L12 12Z" fill="#96CE3A" />
          <path d="M12 12L3.34 17A10 10 0 0 1 3.34 7L12 12Z" fill="#1976B8" />
          <path d="M12 12L3.34 7A10 10 0 0 1 12 2V12Z" fill="#6C379C" />
          <path
            d="M12 2V22M3.34 7L20.66 17M20.66 7L3.34 17"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        </g>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="rgba(24, 24, 24, 0.18)"
          strokeWidth="0.9"
        />
      </svg>
    );
  },
);

ColorWheel.displayName = "ColorWheel";
