'use client';

import React from 'react';
import { ChevronRight, ChevronDown, FileIcon, FolderIcon, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useGraphStore, FileTreeNode } from '@/store/graph';
import { navigateToDocument } from '@/features/host/renderer/navigation';

interface FolderTreeItemProps {
    node: FileTreeNode;
    depth?: number;
    onOpenFile?: (filePath: string) => boolean | void;
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({ node, depth = 0, onOpenFile }) => {
    const { currentFile, expandedFolders, toggleFolder } = useGraphStore();

    const isExpanded = expandedFolders.has(node.path);
    const isDirectory = node.type === 'directory';
    const isActive = currentFile === node.path;

    const handleClick = () => {
        if (isDirectory) {
            toggleFolder(node.path);
            return;
        }

        if (onOpenFile) {
            onOpenFile(node.path);
        } else {
            navigateToDocument(node.path);
        }
    };

    const paddingLeft = depth * 12 + 8;

    return (
        <div>
            <button
                onClick={handleClick}
                style={{ paddingLeft: `${paddingLeft}px` }}
                className={clsx(
                    'w-full cursor-pointer text-left text-sm transition-[background-color,color,box-shadow] duration-fast',
                    'flex items-center gap-1.5 rounded-md py-1.5 pr-2 outline-none',
                    'hover:bg-card/82 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                    isActive && !isDirectory && 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.18)]',
                )}
            >
                {/* Chevron for folders */}
                {isDirectory ? (
                    <span className="flex h-4 w-4 items-center justify-center text-foreground/38">
                        {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                        )}
                    </span>
                ) : (
                    <span className="w-4 h-4" /> // Spacer for alignment
                )}

                {/* Icon */}
                {isDirectory ? (
                    isExpanded ? (
                        <FolderOpen className="w-4 h-4 flex-shrink-0 text-primary" />
                    ) : (
                        <FolderIcon className="w-4 h-4 flex-shrink-0 text-primary" />
                    )
                ) : (
                    <FileIcon className={clsx(
                        'w-4 h-4 flex-shrink-0',
                        isActive ? 'text-primary' : 'text-foreground/38'
                    )} />
                )}

                {/* Name */}
                <span className={clsx(
                    'truncate font-mono text-xs',
                    isDirectory ? 'font-medium text-foreground/78' : 'text-foreground/68',
                )}>
                    {node.name}
                </span>
            </button>

            {/* Children */}
            {isDirectory && isExpanded && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FolderTreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onOpenFile={onOpenFile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
