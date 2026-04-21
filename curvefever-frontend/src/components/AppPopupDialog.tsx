import { useEffect, useId, useRef } from "react";
import styles from "../ui.module.css";
import { cx } from "../utils/cx";

type Props = {
    isOpen: boolean;
    eyebrow?: string;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    cancelLabel?: string;
    onCancel?: () => void;
    confirmTone?: "default" | "danger";
};

export default function AppPopupDialog({
    isOpen,
    eyebrow,
    title,
    description,
    confirmLabel,
    onConfirm,
    cancelLabel,
    onCancel,
    confirmTone = "default",
}: Props) {
    const titleId = useId();
    const descriptionId = useId();
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        confirmButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && onCancel) {
                event.preventDefault();
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onCancel]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className={styles["popup-overlay"]}
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onCancel?.();
                }
            }}
        >
            <section
                className={cx(styles.panel, styles["popup-dialog"])}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <div className={styles["popup-copy"]}>
                    {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                    <h2
                        id={titleId}
                        className={cx(styles.title, styles["title-small"], styles["popup-title"])}
                    >
                        {title}
                    </h2>
                    <p id={descriptionId} className={styles["popup-description"]}>
                        {description}
                    </p>
                </div>
                <div className={styles["popup-actions"]}>
                    {cancelLabel && onCancel && (
                        <button
                            type="button"
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-secondary"],
                            )}
                            onClick={onCancel}
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        className={cx(
                            styles["ui-button"],
                            confirmTone === "danger" && styles["ui-button-danger"],
                        )}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}
