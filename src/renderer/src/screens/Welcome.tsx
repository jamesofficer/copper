import {
	Badge,
	Box,
	Button,
	Center,
	EmptyState,
	Heading,
	HStack,
	Icon,
	Menu,
	Portal,
	Spinner,
	Stack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
	LuChevronsUpDown,
	LuFolderGit2,
	LuFolderPlus,
	LuGitPullRequestArrow,
	LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { toaster } from "../components/ui/toaster";

interface Props {
	onSelect(pr: PullRequest): void;
}

export default function Welcome({ onSelect }: Props) {
	const [repositories, setRepositories] = useState<Repository[] | null>(null);
	const [active, setActive] = useState<Repository | null>(null);
	const [prs, setPrs] = useState<PullRequest[] | null>(null);

	useEffect(() => {
		void window.api.listRepositories().then((repos) => {
			setRepositories(repos);
			setActive(repos[0] ?? null);
		});
	}, []);

	useEffect(() => {
		if (!active) {
			setPrs(null);
			return;
		}
		setPrs(null);
		void window.api.listPullRequests(active.slug ?? active.name).then(setPrs);
	}, [active]);

	async function addRepository() {
		try {
			const added = await window.api.addRepository();
			if (!added) return;
			setRepositories((prev) => [
				added,
				...(prev ?? []).filter((repo) => repo.path !== added.path),
			]);
			setActive(added);
		} catch (cause) {
			toaster.create({
				type: "error",
				title: "Couldn’t add repository",
				description:
					cause instanceof Error
						? cause.message.replace(/^.*Error: /, "")
						: String(cause),
				closable: true,
			});
		}
	}

	async function removeActive() {
		if (!active) return;
		const remaining = await window.api.removeRepository(active.path);
		setRepositories(remaining);
		setActive(remaining[0] ?? null);
	}

	function handleMenuSelect(value: string) {
		if (value === "add") {
			void addRepository();
		} else if (value === "remove") {
			void removeActive();
		} else {
			const repo = repositories?.find((known) => known.path === value);
			if (repo) setActive(repo);
		}
	}

	return (
		<Center minH="100vh" px="6">
			<VStack gap="10" w="full" maxW="xl" py="16">
				<VStack gap="2">
					<HStack gap="2.5" color="colorPalette.fg">
						<Icon size="lg">
							<LuGitPullRequestArrow />
						</Icon>
						<Heading size="2xl" letterSpacing="tight">
							PR Reviewer
						</Heading>
					</HStack>
					<Text color="fg.muted" textAlign="center">
						Pick a repository to see its open pull requests.
					</Text>
				</VStack>

				{repositories === null ? (
					<Spinner color="fg.muted" />
				) : repositories.length === 0 ? (
					<EmptyState.Root borderWidth="1px" borderStyle="dashed" rounded="xl">
						<EmptyState.Content>
							<EmptyState.Indicator>
								<LuFolderGit2 />
							</EmptyState.Indicator>
							<VStack textAlign="center">
								<EmptyState.Title>No repositories yet</EmptyState.Title>
								<EmptyState.Description>
									Add a local git repository to start reviewing its pull
									requests.
								</EmptyState.Description>
							</VStack>
							<Button onClick={addRepository}>
								<LuFolderPlus /> Add repository
							</Button>
						</EmptyState.Content>
					</EmptyState.Root>
				) : (
					<VStack gap="6" w="full">
						<Menu.Root onSelect={(details) => handleMenuSelect(details.value)}>
							<Menu.Trigger asChild>
								<Button
									variant="outline"
									size="xl"
									w="full"
									justifyContent="space-between"
									px="5"
								>
									<HStack gap="3" minW="0">
										<Icon color="fg.muted">
											<LuFolderGit2 />
										</Icon>
										<Text fontFamily="mono" fontSize="md" truncate>
											{active
												? (active.slug ?? active.name)
												: "Choose a repository"}
										</Text>
									</HStack>
									<Icon color="fg.muted">
										<LuChevronsUpDown />
									</Icon>
								</Button>
							</Menu.Trigger>
							<Portal>
								<Menu.Positioner>
									<Menu.Content minW="var(--reference-width)">
										{repositories.map((repo) => (
											<Menu.Item key={repo.path} value={repo.path}>
												<VStack gap="0" alignItems="flex-start">
													<Text fontFamily="mono">
														{repo.slug ?? repo.name}
													</Text>
													<Text fontSize="xs" color="fg.muted">
														{repo.path}
													</Text>
												</VStack>
											</Menu.Item>
										))}
										<Menu.Separator />
										<Menu.Item value="add">
											<LuFolderPlus /> Add local repository…
										</Menu.Item>
										{active && (
											<Menu.Item
												value="remove"
												color="fg.error"
												_hover={{ bg: "bg.error", color: "fg.error" }}
											>
												<LuTrash2 /> Remove {active.name} from list
											</Menu.Item>
										)}
									</Menu.Content>
								</Menu.Positioner>
							</Portal>
						</Menu.Root>

						{active && !active.slug && (
							<Text fontSize="sm" color="fg.muted">
								This repository has no GitHub remote, so pull requests can’t be
								loaded.
							</Text>
						)}

						{active &&
							(prs === null ? (
								<HStack color="fg.muted" py="8">
									<Spinner size="sm" />
									<Text fontSize="sm">Loading open pull requests…</Text>
								</HStack>
							) : prs.length === 0 ? (
								<Text fontSize="sm" color="fg.muted" py="8">
									No open pull requests. Nice and quiet.
								</Text>
							) : (
								<Stack gap="3" w="full">
									<Text
										fontSize="xs"
										color="fg.muted"
										textTransform="uppercase"
										letterSpacing="wider"
									>
										Open pull requests
									</Text>
									{prs.map((pr) => (
										<Box
											key={`${pr.repo}#${pr.number}`}
											as="button"
											onClick={() => onSelect(pr)}
											textAlign="left"
											borderWidth="1px"
											rounded="lg"
											px="5"
											py="4"
											cursor="pointer"
											transition="backgrounds"
											_hover={{
												bg: "bg.subtle",
												borderColor: "colorPalette.muted",
											}}
										>
											<HStack justifyContent="space-between" gap="4">
												<VStack gap="1" alignItems="flex-start" minW="0">
													<Text fontWeight="semibold" truncate>
														{pr.title}
													</Text>
													<HStack
														fontFamily="mono"
														fontSize="xs"
														color="fg.muted"
														gap="3"
													>
														<Text>#{pr.number}</Text>
														<Text>{pr.author}</Text>
														<Text>{pr.changedFiles} files</Text>
													</HStack>
												</VStack>
												<HStack
													fontFamily="mono"
													fontSize="xs"
													gap="2"
													flexShrink="0"
												>
													<Badge colorPalette="green" variant="surface">
														+{pr.additions}
													</Badge>
													<Badge colorPalette="red" variant="surface">
														−{pr.deletions}
													</Badge>
												</HStack>
											</HStack>
										</Box>
									))}
								</Stack>
							))}
					</VStack>
				)}
			</VStack>
		</Center>
	);
}
