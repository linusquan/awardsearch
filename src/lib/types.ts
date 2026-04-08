export interface AwardResult {
  awardShow: string;
  earlyBirdDeadline: string;
  submissionDeadline: string;
  category: string;
  entryCost: string;
  website: string;
  ceremonyDetails: string;
  notes: string;
  status: "pending" | "researching" | "done" | "error";
  error?: string;
}

export interface ResearchEvent {
  type: "status" | "result" | "error" | "done" | "log";
  awardIndex: number;
  awardName: string;
  message?: string;
  result?: AwardResult;
}

export interface LogEntry {
  timestamp: string;
  awardIndex: number;
  awardName: string;
  level: "tool" | "result" | "assistant" | "system" | "error" | "tokens";
  message: string;
}
