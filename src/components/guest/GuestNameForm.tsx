"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Button from "@/components/shared/Button";

interface GuestNameFormProps {
  albumName: string;
  onSubmit: (name: string) => void;
}

export default function GuestNameForm({ albumName, onSubmit }: GuestNameFormProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen px-6"
    >
      <div className="w-full max-w-sm">
        {/* Album name */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light text-primary text-sm font-medium mb-4">
            Joining: {albumName}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            What&apos;s your name?
          </h1>
          <p className="text-sm text-muted mt-2">
            This will be shown alongside your uploads
          </p>
        </div>

        {/* Name input */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoFocus
            className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-lg text-center placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <Button
            type="submit"
            disabled={!name.trim()}
            className="w-full"
            size="lg"
          >
            Continue
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
