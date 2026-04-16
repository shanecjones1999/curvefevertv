import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
    joinUrl: string | null;
};

export default function HostJoinQr({ joinUrl }: Props) {
    const [qrCode, setQrCode] = useState<{
        joinUrl: string;
        src: string;
    } | null>(null);

    useEffect(() => {
        let isActive = true;

        if (!joinUrl) {
            return () => {
                isActive = false;
            };
        }

        void QRCode.toDataURL(joinUrl, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 168,
            color: {
                dark: "#10214f",
                light: "#f6fbff",
            },
        })
            .then((dataUrl) => {
                if (isActive) {
                    setQrCode({
                        joinUrl,
                        src: dataUrl,
                    });
                }
            })
            .catch(() => {
                if (isActive) {
                    setQrCode(null);
                }
            });

        return () => {
            isActive = false;
        };
    }, [joinUrl]);

    if (!joinUrl) {
        return null;
    }

    return (
        <div
            className="host-join-qr"
            role="group"
            aria-label="Phone join QR code"
        >
            <p className="host-join-qr-label">Scan to join</p>
            <div className="host-join-qr-frame" aria-hidden="true">
                {qrCode?.joinUrl === joinUrl ? (
                    <img
                        className="host-join-qr-image"
                        src={qrCode.src}
                        alt="QR code to open the player join screen"
                    />
                ) : (
                    <div
                        className="host-join-qr-placeholder"
                        aria-hidden="true"
                    >
                        Generating QR…
                    </div>
                )}
            </div>
        </div>
    );
}
