import { createFileRoute } from "@tanstack/react-router";
import { DaybookApp } from "@/components/daybook/app";

export const Route = createFileRoute("/")({ component: DaybookApp });
