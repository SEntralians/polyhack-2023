import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import cohere from "~/server/api/services/cohere";
import {
  getFirstDayOfWeek,
  getLastDayOfWeek,
} from "~/server/api/helpers/dates";
import { askChatGpt } from "../services/openai";
import { getCosineSimilarity } from "../services/wink-nlp";
import { parseSummary } from "../helpers/strings";
import { COSING_SIMILARITY_THRESHOLD } from "~/constants";

import { validateJournalOwnership } from "../middlewares/journal";

export const journalRouter = createTRPCRouter({
  getUserJournals: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.journal.findMany({
      where: {
        userId: ctx.session.user.id,
      },
    });
  }),
  getJournal: protectedProcedure
    .input(z.object({ id: z.string().nullable() }))
    .query(async ({ input, ctx }) => {
      const { id } = input;
      if (!id) return null;

      await validateJournalOwnership(ctx, id);

      return ctx.prisma.journal.findUnique({
        where: {
          id,
        },
      });
    }),
  createJournal: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let summary: string | null = null;

      try {
        summary = await cohere
          .summarize({
            text: input.description,
            length: "auto",
            format: "bullets",
            model: "summarize-xlarge",
            additional_command: "",
            temperature: 0.3,
          })
          .then((result) => result.body.summary);
      } catch {
        summary = input.description;
      }

      return ctx.prisma.journal.create({
        data: {
          title: input.title,
          description: input.description,
          summary: summary ?? input.description,
          user: {
            connect: {
              id: ctx.session.user.id,
            },
          },
        },
      });
    }),
  updateJournal: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await validateJournalOwnership(ctx, input.id);

      let summary: string | null = null;

      try {
        summary = await cohere
          .summarize({
            text: input.description,
            length: "auto",
            format: "bullets",
            model: "summarize-xlarge",
            additional_command: "",
            temperature: 0.3,
          })
          .then((result) => result.body.summary);
      } catch {
        summary = input.description;
      }

      return ctx.prisma.journal.update({
        where: {
          id: input.id,
        },
        data: {
          title: input.title,
          description: input.description,
          summary: summary ?? input.description,
        },
      });
    }),
  deleteJournal: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )

    .mutation(async ({ input, ctx }) => {
      await validateJournalOwnership(ctx, input.id);

      return ctx.prisma.journal.delete({
        where: {
          id: input.id,
        },
      });
    }),
  generateWeeklyReports: protectedProcedure.mutation(async ({ ctx }) => {
    const firstDayOfWeek = getFirstDayOfWeek().toDate();
    const lastDayOfWeek = getLastDayOfWeek().toDate();

    const journals = await ctx.prisma.journal.findMany({
      where: {
        userId: ctx.session.user.id,
        createdAt: {
          gte: firstDayOfWeek,
          lte: lastDayOfWeek,
        },
      },
    });

    const journalSummaries = journals
      .map((journal) => {
        return `Journal Title: ${journal.title} - Journal Summary: ${
          journal.summary
        } - Created Date: ${journal.createdAt.toDateString()}`;
      })
      .join("; ");

    const inputPrompt = `Please make an overview of what has happened over the week and give me encouraging statements to uplift my spirts. The following are the journals that have been created this week: ${journalSummaries}.`;
    const weeklyReport = await askChatGpt(inputPrompt);

    return ctx.prisma.user.update({
      where: {
        id: ctx.session.user.id,
      },
      data: {
        weeklyReport,
      },
    });
  }),
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const journals = await ctx.prisma.journal.findMany({
        where: {
          userId: ctx.session.user.id,
        },
      });

      if (input.query === "") return journals;

      const filteredJournals = journals
        .map((journal) => {
          const similarity = getCosineSimilarity(input.query, journal.summary);
          const summary = parseSummary(journal.summary);
          return {
            ...journal,
            similarity,
            summary,
          };
        })
        .filter((journal) => journal.similarity > COSING_SIMILARITY_THRESHOLD);

      return filteredJournals;
    }),
});
