export type AppLocale = 'ko' | 'en';

export interface AppMessages {
  ui: {
    exportDialog: {
      title: string;
      formatLabel: string;
      backgroundLabel: string;
      backgroundOptions: {
        grid: string;
        transparent: string;
        solidWhite: string;
      };
      areaLabel: string;
      areaOptions: {
        selection: string;
        full: string;
      };
      previewLabel: string;
      scopeLabels: {
        selection: string;
        full: string;
      };
      copyButton: string;
      downloadButton: string;
      copyButtonTitle: string;
      copyUnsupportedTitle: string;
      exportFailed: string;
      copyFailed: string;
    };
    header: {
      back: string;
      menu: string;
      untitledCanvas: string;
      search: string;
      searchTitle: string;
    };
    quickOpen: {
      placeholder: string;
      noResults: string;
      commandHint: string;
      footer: {
        enter: string;
        esc: string;
      };
    };
    searchOverlay: {
      dialogLabel: string;
      placeholder: string;
      inputLabel: string;
      closeLabel: string;
      modeLabels: {
        global: string;
        page: string;
      };
      emptyHint: {
        global: string;
        page: string;
      };
      noResults: string;
      resultCount: (count: number) => string;
      resultTypeLabels: {
        element: string;
        file: string;
      };
      footer: {
        move: string;
        execute: string;
        close: string;
      };
    };
    backgroundSelector: {
      title: string;
      options: {
        dots: string;
        lines: string;
        solid: string;
      };
    };
    fontSelector: {
      title: string;
      currentPrefix: string;
      options: {
        handGaegu: string;
        handCaveat: string;
        sansInter: string;
      };
      short: {
        handGaegu: string;
        handCaveat: string;
        sansInter: string;
      };
    };
    themeMode: {
      light: string;
      dark: string;
      system: string;
      useTheme: (label: string) => string;
    };
    stickerInspector: {
      title: string;
      applyPreset: string;
      outlineColor: string;
      outlineWidth: string;
      padding: string;
      rotation: string;
      shadow: string;
      shadowOptions: {
        none: string;
        sm: string;
        md: string;
        lg: string;
      };
    };
  };
  workspace: {
    sidebar: {
      brand: string;
      workspaces: string;
      templates: string;
      components: string;
      settings: string;
      errorBadge: string;
    };
    dashboard: {
      title: string;
      addLabel: string;
      addWorkspaceDialogTitle: string;
      emptyTitle: string;
      emptyBody: string;
      noResults: (query: string) => string;
      addWorkspaceError: string;
    };
    detail: {
      backToWorkspaces: string;
      addCanvasLabel: string;
      workspaceNotFound: string;
      returnToDashboard: string;
      loadingCanvases: string;
      noCanvases: string;
      noResults: (query: string) => string;
      loadCanvasesError: string;
      createCanvasError: string;
    };
    shared: {
      untitledCanvas: string;
      canvasLabel: string;
      lastEditedRecently: string;
      searchPlaceholder: string;
    };
  };
  canvas: {
    toolbar: {
      disabledReasons: {
        pendingEntrypointAction: string;
        missingActionBinding: string;
      };
      sections: {
        interaction: string;
        create: string;
        viewport: string;
        canvas: string;
      };
      interaction: {
        select: string;
        pan: string;
      };
      create: {
        mindmap: string;
        rectangle: string;
        ellipse: string;
        diamond: string;
        text: string;
        markdown: string;
        line: string;
        sticky: string;
        image: string;
        sticker: string;
        'washi-tape': string;
      };
      viewport: {
        zoomIn: string;
        zoomOut: string;
        fitView: string;
      };
    };
    floatingToolbar: {
      selectionModeTitle: string;
      panModeTitle: string;
      createModeTitle: (label: string) => string;
      openCreateModesTitle: string;
      createOnPaneClick: string;
      createModeOff: string;
      washiPresetCatalogTitle: string;
      washiPresetCatalogDisabledTitle: string;
      washiPresetMenuLabel: string;
      activePresetLabel: (label: string) => string;
    };
    paneMenu: {
      createMindmap: string;
      createRectangle: string;
      createEllipse: string;
      createDiamond: string;
      createText: string;
      createMarkdown: string;
      createLine: string;
      createSticky: string;
      createImage: string;
      createSticker: string;
      createWashiTape: string;
      exportAll: string;
      fitView: string;
    };
    nodeMenu: {
      copyAsPng: string;
      exportSelection: string;
      renameNode: string;
      addMindmapChild: string;
      addMindmapSibling: string;
      mindmapTemplate: string;
      selectGroup: string;
      enterGroup: string;
      groupSelection: string;
      ungroupSelection: string;
      bringToFront: string;
      sendToBack: string;
      duplicateNode: string;
      deleteNode: string;
      toggleLock: string;
    };
    selectionMenu: {
      inventory: {
        objectType: string;
        fontFamily: string;
        fontSize: string;
        bold: string;
        align: string;
        color: string;
        more: string;
        content: string;
        washiPreset: string;
      };
      controlFallbacks: {
        font: string;
        size: string;
        bold: string;
        type: string;
        align: string;
        color: string;
        more: string;
      };
      fontOptions: {
        handGaegu: string;
        handCaveat: string;
        sansInter: string;
      };
      fontShort: {
        handGaegu: string;
        handCaveat: string;
        sansInter: string;
      };
      contentLabel: string;
      applyContent: string;
      washiPresetLabel: string;
      ok: string;
    };
  };
  defaultContent: {
    nodeIdSeeds: Record<string, string>;
    nodeContent: {
      shape: string;
      text: string;
      markdown: string;
      sticky: string;
      sticker: string;
    };
    imageSource: string;
    pluginDisplayName: string;
    pluginExamples: {
      chartTitle: string;
      chartSeriesLabels: string[];
      chartFallbackSeriesLabel: (index: number) => string;
    };
  };
}
