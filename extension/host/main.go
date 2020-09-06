package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/storage/memory"

	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
)

type FunctionType int

const (
	Unknown FunctionType = iota
	Initialize
	Apply
)

type Csv struct {
	Path  string `json:"path"`
	Value string `json:"value"`
}

type Request struct {
	FunctionType      FunctionType `json:"functionType"`
	RepositoryUrl     string       `json:"repositoryUrl"`
	Username          string       `json:"username"`
	Email             string       `json:"email"`
	GitHubAccessToken string       `json:"gitHubAccessToken"`
	TargetBranchName  string       `json:"targetBranchName"`
	ParentBranchNames []string     `json:"parentBranchNames"`
	CommitMessage     string       `json:"commitMessage"`
	CreatePR          bool         `json:"createPR"`
	PRTitle           string       `json:"prTitle"`
	PRBaseBranchName  string       `json:"prBaseBranchName"`
	Csvs              []Csv        `json:"csvs"`
}

type Response struct {
	ErrorMessage string `json:"errorMessage"`
}

var filesystem billy.Filesystem
var repository *git.Repository
var ownerName string
var repositoryName string
var gitHubAccessToken string

func main() {
	for {
		msg := readMessage()

		var req Request
		err := json.Unmarshal(msg, &req)
		if err != nil {
			sendMessage([]byte(fmt.Sprintf(`{"errorMessage":"%s"}`, err)))
			continue
		}

		switch req.FunctionType {
		case Initialize:
			gitHubAccessToken = req.GitHubAccessToken
			result := strings.Split(req.RepositoryUrl, "/")
			ownerName = result[3]
			repositoryName = result[4]
			err = initialize(req.Username)
			if err == nil {
				sendMessage([]byte("{}"))
				continue
			}
		case Apply:
			err = apply(req.TargetBranchName, req.ParentBranchNames, req.CommitMessage, req.Username, req.Email, req.Csvs)
			if err != nil {
				break
			}
			var prUrl string
			if req.CreatePR {
				prUrl, err = createPR(req.PRTitle, req.TargetBranchName, req.PRBaseBranchName)
			}
			if err == nil {
				sendMessage([]byte(fmt.Sprintf(`{"prUrl":"%s"}`, prUrl)))
				continue
			}
		default:
			sendMessage([]byte(`{"errorMessage":"Unknown functionType."}`))
			continue
		}

		if err != nil {
			sendMessage([]byte(fmt.Sprintf(`{"errorMessage":"%s"}`, err)))
		}
	}
}

func initialize(username string) error {
	filesystem = memfs.New()
	var err error
	repository, err = git.Clone(memory.NewStorage(), filesystem, &git.CloneOptions{
		URL: fmt.Sprintf("https://%s:%s@github.com/%s/%s.git", username, gitHubAccessToken, ownerName, repositoryName),
	})
	if err != nil {
		return fmt.Errorf("Failed clone repository.\nCheck GitHub Access Token or Config File Id.\n\n%s", err)
	}
	return nil
}

func apply(targetBranchName string, parentBranchNames []string, commitMessage string, username string, email string, csvs []Csv) error {
	refs, err := repository.References()
	if err != nil {
		return err
	}
	refs.ForEach(func(ref *plumbing.Reference) error {
		if strings.HasPrefix(ref.Name().String(), "refs/remotes/origin/") {
			err = repository.Storer.RemoveReference(ref.Name())
			return err
		}
		return nil
	})
	repository.Fetch(&git.FetchOptions{})

	targetRef, err := repository.Storer.Reference(plumbing.ReferenceName(targetBranchName))
	if err == nil {
		err = repository.Storer.RemoveReference(targetRef.Name())
		if err != nil {
			return err
		}
	}

	w, err := repository.Worktree()
	if err != nil {
		return err
	}

	remoteRef, err := repository.Reference(plumbing.NewRemoteReferenceName("origin", targetBranchName), true)
	var coHash plumbing.Hash
	if err == nil {
		coHash = remoteRef.Hash()
	} else {
		for _, parentBranchName := range parentBranchNames {
			parentRef, err := repository.Reference(plumbing.NewRemoteReferenceName("origin", parentBranchName), true)
			if err == nil {
				coHash = parentRef.Hash()
				break
			}
		}
	}

	refName := plumbing.ReferenceName(targetBranchName)
	err = w.Checkout(&git.CheckoutOptions{
		Hash:   coHash,
		Branch: refName,
		Create: true,
		Force:  true,
	})
	if err != nil {
		return err
	}

	var addedCsvPaths []string
	for _, csv := range csvs {
		csvPath := csv.Path + ".csv"
		file, err := filesystem.OpenFile(csvPath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0666)
		if err != nil {
			return err
		}
		file.Write([]byte(csv.Value))

		_, err = w.Add(csvPath)
		if err != nil {
			continue
		}

		addedCsvPaths = append(addedCsvPaths, csvPath)
	}

	if len(addedCsvPaths) == 0 {
		return fmt.Errorf("%s", "Not changed.")
	}

	if commitMessage == "" {
		commitMessage = "Update " + strings.Join(addedCsvPaths, ", ")
	}
	cHash, err := w.Commit(commitMessage, &git.CommitOptions{
		Author: &object.Signature{
			Name:  username,
			Email: email,
			When:  time.Now(),
		},
	})
	if err != nil {
		return err
	}

	repository.Storer.SetReference(plumbing.NewHashReference(plumbing.ReferenceName(targetBranchName), cHash))

	remote, err := repository.Remote("origin")
	if err != nil {
		return err
	}
	err = remote.Push(&git.PushOptions{
		RefSpecs: []config.RefSpec{
			config.RefSpec(refName + ":" + plumbing.ReferenceName("refs/heads/"+targetBranchName)),
		},
	})
	if err != nil {
		return err
	}

	return nil
}

func createPR(title string, commitBranchName string, baseBranchName string) (string, error) {
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: gitHubAccessToken})
	tc := oauth2.NewClient(oauth2.NoContext, ts)
	client := github.NewClient(tc)

	newPR := &github.NewPullRequest{
		Title: &title,
		Head:  &commitBranchName,
		Base:  &baseBranchName,
	}

	pr, _, err := client.PullRequests.Create(oauth2.NoContext, ownerName, repositoryName, newPR)
	if err != nil {
		if strings.Contains(err.Error(), "A pull request already exists for") {
			return "", nil
		}
		return "", err
	}

	return *pr.HTMLURL, nil
}

func readMessage() []byte {
	r := bufio.NewReader(os.Stdin)
	length := make([]byte, 4)
	r.Read(length)
	msg := make([]byte, readMessageLength(length))
	io.ReadFull(r, msg)
	return msg
}

func readMessageLength(msg []byte) int {
	var length uint32
	buf := bytes.NewBuffer(msg)
	binary.Read(buf, binary.LittleEndian, &length)
	return int(length)
}

func sendMessage(msg []byte) {
	var buf bytes.Buffer
	binary.Write(os.Stdout, binary.LittleEndian, uint32(len(msg)))
	buf.Write(msg)
	buf.WriteTo(os.Stdout)
}
