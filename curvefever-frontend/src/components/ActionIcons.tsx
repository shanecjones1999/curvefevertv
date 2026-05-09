type IconProps = {
    className?: string;
};

type FullscreenIconProps = IconProps & {
    active?: boolean;
};

export function FullscreenIcon({
    active = false,
    className,
}: FullscreenIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {active ? (
                <>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </>
            ) : (
                <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </>
            )}
        </svg>
    );
}

export function LeaveGameIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
        </svg>
    );
}

type SoundIconProps = IconProps & {
    muted?: boolean;
};

export function SoundIcon({ muted = false, className }: SoundIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M11 5 6 9H3v6h3l5 4z" />
            {muted ? (
                <>
                    <path d="m17 9 4 6" />
                    <path d="m21 9-4 6" />
                </>
            ) : (
                <>
                    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
                </>
            )}
        </svg>
    );
}

type DiagnosticsIconProps = IconProps & {
    active?: boolean;
};

export function DiagnosticsIcon({
    active = false,
    className,
}: DiagnosticsIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 19h16" />
            <path d="M7 15v-4" />
            <path d="M12 15V9" />
            <path d="M17 15V6" />
            {active ? <circle cx="17" cy="6" r="2" fill="currentColor" /> : null}
        </svg>
    );
}
