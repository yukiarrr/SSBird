package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "msbird",
	Short: "CLI for MasterBird, master data management tool",
	Long: `This is the CLI for MasterBird, master data management tool.
This CLI can reflect csv data to Spreadsheet.
It is intended to be used on CI/CD pipeline.`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
