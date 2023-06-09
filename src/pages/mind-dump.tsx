/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { useState } from "react";
import dayjs from "dayjs";
import {
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useForm } from "react-hook-form";
import toast, { Toaster } from "react-hot-toast";
import { Loader } from "~/components/loaders";
import Navbar from "~/components/navbar";
import { useJournalStore } from "~/stores/journal";

import { withAuth } from "~/middlewares";
import { api } from "~/utils/api";

import type { Journal } from "@prisma/client";

enum JournalStatus {
  Creating = "creating",
  Editing = "editing",
  Viewing = "viewing",
  NotUsing = "not-using",
}

const MindDump = () => {
  const utils = api.useContext();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Journal>();

  const journalId = useJournalStore((state) => state.id);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(
    journalId
  );
  const [journalStatus, setJournalStatus] = useState<JournalStatus>(
    journalId ? JournalStatus.Viewing : JournalStatus.NotUsing
  );

  const { data: journals } = api.journal.getUserJournals.useQuery();
  const { data: journal } = api.journal.getJournal.useQuery(
    { id: selectedJournalId },
    {
      enabled: !!selectedJournalId,
      onSuccess: (data) => {
        if (data) {
          setValue("title", data.title);
          setValue("description", data.description);
        }
      },
    }
  );
  const { mutate: createJournal, isLoading: isCreatingLoading } =
    api.journal.createJournal.useMutation({
      onSuccess: async () => {
        reset({
          title: "",
          description: "",
        });
        setJournalStatus(JournalStatus.NotUsing);
        await utils.journal.getUserJournals.invalidate();
        await utils.journal.getJournal.invalidate();
        toast.success("Journal created!");
      },
    });
  const { mutate: updateJournal, isLoading: isUpdatingLoading } =
    api.journal.updateJournal.useMutation({
      onSuccess: async () => {
        reset({
          title: "",
          description: "",
        });
        setJournalStatus(JournalStatus.NotUsing);
        await utils.journal.getUserJournals.invalidate();
        await utils.journal.getJournal.invalidate();
        toast.success("Journal edited!");
      },
    });
  const { mutate: deleteJournal } = api.journal.deleteJournal.useMutation({
    onSuccess: async () => {
      setJournalStatus(JournalStatus.NotUsing);
      await utils.journal.getUserJournals.invalidate();
      await utils.journal.getJournal.invalidate();
      toast.success("Journal deleted!");
    },
  });

  const setIsCreatingJournal = () => {
    reset({
      title: "",
      description: "",
    });
    setJournalStatus(JournalStatus.Creating);
  };

  const addJournal = (journal: Journal) => {
    createJournal({
      title: journal.title,
      description: journal.description,
    });
  };

  const editJournalEntry = (journal: Journal) => {
    if (!selectedJournalId) return;
    updateJournal({
      id: selectedJournalId,
      title: journal.title,
      description: journal.description,
    });
  };

  const selectJournal = (id: string) => () => {
    setSelectedJournalId(id);
    setJournalStatus(JournalStatus.Viewing);
  };

  const editJournal = (id: string) => {
    setSelectedJournalId(id);
    setJournalStatus(JournalStatus.Editing);
  };

  const isViewingJournal = journalStatus === JournalStatus.Viewing;
  const isCreatingJournal = journalStatus === JournalStatus.Creating;
  const isEditingJournal = journalStatus === JournalStatus.Editing;
  const isNotUsingJournal = journalStatus === JournalStatus.NotUsing;

  if (!journals) {
    return <div></div>;
  }

  return (
    <div>
      <Navbar currentPage="home" />
      <div className="absolute top-0 -z-50 flex h-screen w-screen bg-background-100 pt-16 text-primary-200">
        {/* Left Side */}
        <div className="my-10 max-h-screen w-3/12 overflow-y-scroll bg-primary-100">
          <div
            className="mx-5 my-5 flex cursor-pointer items-center gap-3 rounded-lg border border-primary-200 bg-secondary-100 p-5 font-thin hover:opacity-50"
            onClick={setIsCreatingJournal}
          >
            <PlusCircleIcon className="text-primary-500 h-8 w-8" />
            <div className="m- text-2xl font-bold">New Journal</div>
          </div>

          {journals.map((journal) => (
            <div
              key={journal.id}
              className="relative mx-5 my-5 cursor-pointer rounded-md border-b border-primary-200 bg-secondary-100 p-4"
            >
              <div className="text-lg font-bold">
                {dayjs(journal.createdAt).format("MMMM DD, YYYY")}
              </div>
              <div className="mt-2">
                {journal.title.length > 30
                  ? `${journal.title.slice(0, 30)}...`
                  : journal.title}
              </div>
              <div className="absolute right-4 top-8 -translate-y-1/2 transform">
                <button
                  className="mr-2"
                  onClick={() => editJournal(journal.id)}
                >
                  <PencilIcon className="z-30 h-6 w-6 hover:opacity-80" />
                </button>
                <button
                  onClick={() =>
                    deleteJournal({
                      id: journal.id,
                    })
                  }
                >
                  <TrashIcon className="w-6hover:opacity-80 h-6" />
                </button>
              </div>
              <div
                className="mt-5 font-bold opacity-80"
                onClick={selectJournal(journal.id)}
              >
                View Journal
              </div>
            </div>
          ))}
          {journals.length === 0 && (
            <div className="mx-5 my-5 cursor-pointer border-b border-gray-800 bg-primary-200 p-4">
              <div className="text-lg font-bold">No journals yet</div>
            </div>
          )}
        </div>

        {/* Right Side */}
        {journal && isViewingJournal && (
          <div className="mx-16 my-6 w-9/12 p-8">
            <h1 className="mb-4 text-6xl font-bold">{journal.title}</h1>
            <div className="mx-10 my-6 flex flex-row items-start gap-5">
              <p className="mb-4">{journal.description}</p>
            </div>

            <h2 className="mx-10 mt-5 text-3xl font-bold text-primary-100">
              Summary:
            </h2>
            <div className="mx-10 mt-5 rounded-lg bg-secondary-100 px-5 py-3">
              {journal.summary.split("-").map((summary, index) => {
                if (summary === "") return;
                return (
                  <div key={index} className="mb-2">
                    <span className="mr-3 font-bold">-</span>
                    {summary.trim()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!journal && isNotUsingJournal && (
          <div className="my-20 w-9/12 p-8">
            {/* no journal yet */}
            <h1 className="mb-4 text-4xl font-bold">No Journal Selected</h1>
          </div>
        )}
        {isCreatingJournal && (
          <form
            className="my-20 w-9/12 p-8 text-primary-100"
            onSubmit={handleSubmit(addJournal)}
          >
            <div className="mb-4">
              <label className="mb-2 block text-6xl font-bold" htmlFor="title">
                Title
              </label>
              <input
                {...register("title", { required: true })}
                className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-black shadow focus:outline-none"
                id="title"
                type="text"
                placeholder="Title"
              />
              {errors.title && <span>This field is required</span>}
            </div>

            <div className="mb-4">
              <label
                className="mb-2 block text-4xl  font-bold"
                htmlFor="description"
              >
                Description
              </label>
              <textarea
                {...register("description", { required: true })}
                className="focus:shadow-outline h-52 w-full appearance-none rounded border px-3 py-2 leading-tight text-black shadow focus:outline-none"
                id="description"
                placeholder="Description"
              />
              {errors.description && <span>This field is required</span>}
            </div>

            <button
              className="hover:bg-primary-70 focus:shadow-outline flex flex-row gap-1 rounded bg-primary-200 px-4 py-2 font-bold text-white hover:opacity-80 focus:outline-none"
              type="submit"
            >
              {isCreatingLoading && <Loader />}
              Add Journal
            </button>
          </form>
        )}
        {isEditingJournal && (
          <form
            className="my-20 w-9/12 p-8"
            onSubmit={handleSubmit(editJournalEntry)}
          >
            <div className="mb-4">
              <label
                className="mb-2 block text-6xl font-bold text-primary-100"
                htmlFor="title"
              >
                Title
              </label>
              <input
                {...register("title", { required: true })}
                className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-black shadow focus:outline-none"
                id="title"
                type="text"
                placeholder="Title"
              />
              {errors.title && <span>This field is required</span>}
            </div>

            <div className="mb-4">
              <label
                className="mb-2 block text-4xl font-bold text-primary-100"
                htmlFor="description"
              >
                Description
              </label>
              <textarea
                {...register("description", { required: true })}
                className="focus:shadow-outline h-52 w-full appearance-none rounded border px-3 py-2 leading-tight text-black shadow focus:outline-none"
                id="description"
                placeholder="Description"
              />
              {errors.description && <span>This field is required</span>}
            </div>

            <button
              className="hover:bg-primary-70 focus:shadow-outline flex flex-row gap-1 rounded bg-primary-200 px-4 py-2 font-bold text-white hover:opacity-80 focus:outline-none"
              type="submit"
            >
              {isUpdatingLoading && <Loader />}
              Edit Journal
            </button>
          </form>
        )}
      </div>
      <Toaster />
    </div>
  );
};

export default withAuth(MindDump);
