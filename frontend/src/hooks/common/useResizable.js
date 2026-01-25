
import { useState, useCallback, useRef, useEffect } from "react";

export function useResizable({
  initialSize = 50,
  minSize = 300,
  maxSize = 80,
  direction = "horizontal",
} = {}) {
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previousSize, setPreviousSize] = useState(initialSize);
  
  const containerRef = useRef(null);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    startSizeRef.current = size;
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [direction, size]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerSize = direction === "horizontal" 
      ? containerRect.width 
      : containerRect.height;

    const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
    const startPos = direction === "horizontal" 
      ? containerRect.left 
      : containerRect.top;

    const newSizePercent = ((currentPos - startPos) / containerSize) * 100;

    const maxSizePercent = typeof maxSize === "number" && maxSize > 100 
      ? (maxSize / containerSize) * 100 
      : maxSize;

    const minSizePercent = (minSize / containerSize) * 100;

    const clampedSize = Math.min(
      Math.max(newSizePercent, minSizePercent),
      maxSizePercent
    );

    requestAnimationFrame(() => {
      setSize(clampedSize);
    });
  }, [isDragging, direction, minSize, maxSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      setPreviousSize(size);
      setSize(0); 
    } else {
      setSize(previousSize);
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen, size, previousSize]);

  const minimizeEditor = useCallback(() => {
    if (!isFullscreen) {
      setPreviousSize(size);
    }
    setSize(100); 
  }, [isFullscreen, size]);

  const restoreSize = useCallback(() => {
    setSize(previousSize || initialSize);
    setIsFullscreen(false);
  }, [previousSize, initialSize]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        restoreSize();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, restoreSize]);

  return {
    size,
    setSize,
    isDragging,
    isFullscreen,
    containerRef,
    handleMouseDown,
    toggleFullscreen,
    minimizeEditor,
    restoreSize,
  };
}

export default useResizable;
