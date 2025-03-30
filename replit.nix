{pkgs}: {
  deps = [
    pkgs.libiconv
    pkgs.unzip
    pkgs.jq
    pkgs.sqlite
    pkgs.zip
    pkgs.glibcLocales
    pkgs.postgresql
  ];
}
