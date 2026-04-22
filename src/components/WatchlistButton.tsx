"use client";

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useWatchlist, WatchlistToken } from "@/hooks/useWatchlist";

interface WatchlistButtonProps {
    token: WatchlistToken;
    className?: string;
    onToggle?: (isWatched: boolean) => void;
}

const WatchlistButton: React.FC<WatchlistButtonProps> = ({ token, className = "", onToggle }) => {
    const { addToWatchlist, removeFromWatchlist, isWatched, watchlist } = useWatchlist();
    const [watched, setWatched] = useState(false);

    // Sync local state with hook state (crucial for initial load and updates)
    useEffect(() => {
        setWatched(isWatched(token.contract));
    }, [watchlist, token.contract, isWatched]); // Dependency on watchlist ensures updates

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (watched) {
            removeFromWatchlist(token.contract);
        } else {
            addToWatchlist(token);
        }
        // State update will happen via useEffect
    };

    return (
        <button
            onClick={handleClick}
            className={`flex items-center gap-2  rounded-md transition-all duration-200 hover:text-orange-500 ${className}`}
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
            <Star
                className={`transition-all duration-200 ${watched ? "fill-orange-500 text-orange-500" : "text-gray-400 hover:text-orange-500"}`}
                size={15}
            />
            <span className={`md:block hidden ${watched ? "text-orange-500" : "text-gray-400 hover:text-orange-500"}`}>
                {watched ? "Watchlisted" : "Add to watchlist"}
            </span>
        </button>
    );
};

export default WatchlistButton;
